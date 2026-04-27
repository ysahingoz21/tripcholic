import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedTripCollectionDto } from './dto/create-saved-trip-collection.dto';
import { buildTripPreview } from '../trips/trip-preview';
import { CreateTripCommentDto } from './dto/create-trip-comment.dto';
import { ListSavedTripsQueryDto } from './dto/list-saved-trips-query.dto';
import { UpdateTripFeedbackDto } from './dto/update-trip-feedback.dto';
import { UpdateSavedTripCollectionsDto } from './dto/update-saved-trip-collections.dto';

@Injectable()
export class PublicTripsService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly UNGROUPED_COLLECTION_FILTER = 'ungrouped';
  private static readonly FEEDBACK_SIGNAL_DEFINITIONS = [
    { key: 'worked_well', label: 'Worked well' },
    { key: 'too_much_walking', label: 'Too much walking' },
    { key: 'too_expensive', label: 'Too expensive' },
    { key: 'too_rushed', label: 'Too rushed' },
    { key: 'good_for_rainy_weather', label: 'Good for rainy weather' },
    { key: 'worth_repeating', label: 'Worth repeating' },
  ] as const;
  private static readonly MAX_SOCIAL_RATIONALE_ITEMS = 3;

  async findOne(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;

    const trip = await db.trip.findFirst({
      where: this.buildEligiblePublicTripWhere(tripId),
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
        stops: {
          orderBy: { order: 'asc' },
          include: {
            poi: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Public trip not found');
    }

    const [engagement, feedback] = await Promise.all([
      this.getEngagementSnapshot(db, trip.id, userId),
      this.getFeedbackSnapshot(db, trip.id, userId),
    ]);

    return this.toPublicTripDetailResponse(trip, engagement, feedback);
  }

  async remixTrip(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;

    const sourceTrip = await db.trip.findFirst({
      where: this.buildEligiblePublicTripWhere(tripId),
      include: {
        stops: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!sourceTrip) {
      throw new NotFoundException('Public trip not found');
    }

    const remixedTrip = await db.$transaction(async (tx) => {
      const createdTrip = await tx.trip.create({
        data: {
          userId,
          title: sourceTrip.title,
          description: sourceTrip.description,
          date: sourceTrip.date,
          timeStart: sourceTrip.timeStart,
          timeEnd: sourceTrip.timeEnd,
          budgetTl: sourceTrip.budgetTl,
          categories: sourceTrip.categories,
          weather: sourceTrip.weather,
          walkingToleranceKm: sourceTrip.walkingToleranceKm,
          maxPois: sourceTrip.maxPois,
          status: sourceTrip.status,
          visibility: 'DRAFT',
          routeName: sourceTrip.routeName,
          routeTotalDistanceKm: sourceTrip.routeTotalDistanceKm,
          routeTotalDurationMin: sourceTrip.routeTotalDurationMin,
          routeTotalCostTl: sourceTrip.routeTotalCostTl,
          routeAlgorithmUsed: sourceTrip.routeAlgorithmUsed,
          routeExplanation: sourceTrip.routeExplanation,
          optimizedAt: sourceTrip.optimizedAt,
        },
      });

      if (sourceTrip.stops.length > 0) {
        await tx.tripStop.createMany({
          data: sourceTrip.stops.map((stop) => ({
            tripId: createdTrip.id,
            poiId: stop.poiId,
            order: stop.order,
            title: stop.title,
            arrivalTime: stop.arrivalTime,
            departureTime: stop.departureTime,
            travelTimeToNextMin: stop.travelTimeToNextMin,
            estimatedCostTl: stop.estimatedCostTl,
          })),
        });
      }

      return createdTrip;
    });

    return {
      tripId: remixedTrip.id,
    };
  }

  async completeTrip(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    await db.tripCompletion.upsert({
      where: {
        tripId_userId: {
          tripId,
          userId,
        },
      },
      update: {},
      create: {
        tripId,
        userId,
      },
    });

    return {
      engagement: await this.getEngagementSnapshot(db, tripId, userId),
    };
  }

  async uncompleteTrip(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    await db.tripCompletion.deleteMany({
      where: {
        tripId,
        userId,
      },
    });

    return {
      engagement: await this.getEngagementSnapshot(db, tripId, userId),
    };
  }

  async updateTripFeedback(
    userId: string,
    tripId: string,
    payload: UpdateTripFeedbackDto,
  ) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    const completion = await db.tripCompletion.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!completion) {
      throw new ConflictException(
        'You must mark this public trip as completed before leaving feedback',
      );
    }

    const signals = this.normalizeFeedbackSignals(payload.signals);

    await db.tripCompletion.update({
      where: {
        tripId_userId: {
          tripId,
          userId,
        },
      },
      data: {
        feedbackSignals: signals,
      },
    });

    return {
      feedback: await this.getFeedbackSnapshot(db, tripId, userId),
    };
  }

  async likeTrip(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    await db.tripLike.upsert({
      where: {
        tripId_userId: {
          tripId,
          userId,
        },
      },
      update: {},
      create: {
        tripId,
        userId,
      },
    });

    return {
      engagement: await this.getEngagementSnapshot(db, tripId, userId),
    };
  }

  async unlikeTrip(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    await db.tripLike.deleteMany({
      where: {
        tripId,
        userId,
      },
    });

    return {
      engagement: await this.getEngagementSnapshot(db, tripId, userId),
    };
  }

  async listComments(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    const comments = await db.tripComment.findMany({
      where: { tripId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    return {
      items: comments.map((comment) => this.toCommentItem(comment)),
      engagement: await this.getEngagementSnapshot(db, tripId, userId),
    };
  }

  async createComment(
    userId: string,
    tripId: string,
    payload: CreateTripCommentDto,
  ) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    const body = payload.body.trim();
    if (!body) {
      throw new BadRequestException('Comment body cannot be empty');
    }

    const comment = await db.tripComment.create({
      data: {
        tripId,
        userId,
        body,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    return {
      comment: this.toCommentItem(comment),
      engagement: await this.getEngagementSnapshot(db, tripId, userId),
    };
  }

  async saveTrip(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    await db.savedTrip.upsert({
      where: {
        tripId_userId: {
          tripId,
          userId,
        },
      },
      update: {},
      create: {
        tripId,
        userId,
      },
    });

    return {
      engagement: await this.getEngagementSnapshot(db, tripId, userId),
    };
  }

  async unsaveTrip(userId: string, tripId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;
    await this.ensureEligiblePublicTrip(db, tripId);

    await db.savedTrip.deleteMany({
      where: {
        tripId,
        userId,
      },
    });

    return {
      engagement: await this.getEngagementSnapshot(db, tripId, userId),
    };
  }

  async findSavedTrips(userId: string, query: ListSavedTripsQueryDto) {
    const client = await this.prisma.getClient();
    const db = client as any;
    const normalizedCollectionFilter = query.collectionId?.trim() || null;
    const selectedCollection =
      normalizedCollectionFilter &&
      normalizedCollectionFilter !== PublicTripsService.UNGROUPED_COLLECTION_FILTER
        ? await this.findOwnedCollectionOrThrow(
            db,
            userId,
            normalizedCollectionFilter,
          )
        : null;

    const [collections, visibleMembershipRows, visibleSavedTripRecords] =
      await Promise.all([
        this.listSavedTripCollections(db, userId),
        this.listVisibleSavedTripMembershipRows(db, userId),
        db.savedTrip.findMany({
          where: this.buildOwnedSavedTripWhere(userId),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            tripId: true,
          },
        }),
      ]);

    const collectionCounts = new Map<string, number>();
    let ungroupedCount = 0;
    const membershipsBySavedTripId = new Map<
      string,
      Array<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
      }>
    >();

    for (const row of visibleMembershipRows) {
      const memberships = membershipsBySavedTripId.get(row.savedTripId) ?? [];

      if (row.collectionId) {
        memberships.push({
          id: row.collectionId,
          name: row.collectionName!,
          createdAt: row.collectionCreatedAt!,
          updatedAt: row.collectionUpdatedAt!,
        });
        collectionCounts.set(
          row.collectionId,
          (collectionCounts.get(row.collectionId) ?? 0) + 1,
        );
      }

      membershipsBySavedTripId.set(row.savedTripId, memberships);
    }

    const visibleSavedTripIdsInOrder = visibleSavedTripRecords
      .map((savedTrip) => savedTrip.id)
      .filter((savedTripId) => membershipsBySavedTripId.has(savedTripId));

    const filteredSavedTripIds = visibleSavedTripIdsInOrder.filter((savedTripId) => {
      const memberships = membershipsBySavedTripId.get(savedTripId) ?? [];

      if (normalizedCollectionFilter === PublicTripsService.UNGROUPED_COLLECTION_FILTER) {
        return memberships.length === 0;
      }

      if (normalizedCollectionFilter) {
        return memberships.some(
          (membership) => membership.id === normalizedCollectionFilter,
        );
      }

      return true;
    });

    for (const savedTripId of visibleSavedTripIdsInOrder) {
      const memberships = membershipsBySavedTripId.get(savedTripId) ?? [];
      if (memberships.length === 0) {
        ungroupedCount += 1;
      }
    }

    if (filteredSavedTripIds.length === 0) {
      return {
        collections: collections.map((collection) =>
          this.toSavedTripCollectionSummary(
            collection,
            collectionCounts.get(collection.id) ?? 0,
          ),
        ),
        filter: {
          collectionId:
            normalizedCollectionFilter === null ? null : normalizedCollectionFilter,
          selectedCollection:
            selectedCollection !== null
              ? this.toSavedTripCollectionMembership(selectedCollection)
              : null,
          totalSavedCount: visibleSavedTripIdsInOrder.length,
          ungroupedCount,
        },
        items: [],
      };
    }

    const savedTrips = await db.savedTrip.findMany({
      where: {
        id: {
          in: filteredSavedTripIds,
        },
      },
      include: {
        trip: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
            stops: {
              orderBy: { order: 'asc' },
              include: {
                poi: {
                  select: {
                    category: true,
                    district: true,
                    imageUrl: true,
                    lat: true,
                    lng: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const savedTripById = new Map(
      savedTrips.map((savedTrip) => [savedTrip.id, savedTrip]),
    );
    const tripIds = savedTrips.map((savedTrip) => savedTrip.tripId);
    const engagementByTripId = await this.getEngagementSnapshots(db, tripIds, userId);

    return {
      collections: collections.map((collection) =>
        this.toSavedTripCollectionSummary(
          collection,
          collectionCounts.get(collection.id) ?? 0,
        ),
      ),
      filter: {
        collectionId:
          normalizedCollectionFilter === null ? null : normalizedCollectionFilter,
        selectedCollection:
          selectedCollection !== null
            ? this.toSavedTripCollectionMembership(selectedCollection)
            : null,
        totalSavedCount: visibleSavedTripIdsInOrder.length,
        ungroupedCount,
      },
      items: filteredSavedTripIds
        .map((savedTripId) => savedTripById.get(savedTripId))
        .filter(Boolean)
        .map((savedTrip) =>
          this.toSavedTripItem(
            savedTrip,
            membershipsBySavedTripId.get(savedTrip.id) ?? [],
            engagementByTripId.get(savedTrip.tripId) ?? this.createEmptyEngagement(),
          )),
    };
  }

  async createSavedTripCollection(
    userId: string,
    payload: CreateSavedTripCollectionDto,
  ) {
    const client = await this.prisma.getClient();
    const db = client as any;
    const name = payload.name.trim();

    if (!name) {
      throw new BadRequestException('Collection name cannot be empty');
    }

    const existingCollection = await this.findOwnedCollectionByName(db, userId, name);

    if (existingCollection) {
      throw new ConflictException('Saved trip collection already exists');
    }

    const collectionId = randomUUID();
    const createdCollections = (await db.$queryRaw(Prisma.sql`
      INSERT INTO "saved_trip_collections" ("id", "userId", "name", "createdAt", "updatedAt")
      VALUES (${collectionId}, ${userId}, ${name}, NOW(), NOW())
      RETURNING "id", "name", "createdAt", "updatedAt"
    `)) as Array<{
      id: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    const [collection] = createdCollections;

    return {
      collection: this.toSavedTripCollectionSummary(collection, 0),
    };
  }

  async replaceSavedTripCollections(
    userId: string,
    savedTripId: string,
    payload: UpdateSavedTripCollectionsDto,
  ) {
    const client = await this.prisma.getClient();
    const db = client as any;
    const savedTrip = await db.savedTrip.findFirst({
      where: this.buildOwnedSavedTripWhere(userId, savedTripId),
    });

    if (!savedTrip) {
      throw new NotFoundException('Saved public trip not found');
    }

    const collectionIds = this.normalizeCollectionIds(payload.collectionIds);
    const collections =
      collectionIds.length > 0
        ? await this.findOwnedCollectionsByIds(db, userId, collectionIds)
        : [];

    if (collections.length !== collectionIds.length) {
      throw new NotFoundException('One or more saved trip collections were not found');
    }

    await db.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          DELETE FROM "saved_trip_collection_items"
          WHERE "savedTripId" = ${savedTripId}
        `,
      );

      for (const collectionId of collectionIds) {
        const collectionItemId = randomUUID();
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO "saved_trip_collection_items" ("id", "savedTripId", "collectionId", "createdAt")
            VALUES (${collectionItemId}, ${savedTripId}, ${collectionId}, NOW())
          `,
        );
      }
    });

    return {
      savedTripId,
      collections: collections.map((collection) =>
        this.toSavedTripCollectionMembership(collection),
      ),
    };
  }

  async deleteSavedTripCollection(userId: string, collectionId: string) {
    const client = await this.prisma.getClient();
    const db = client as any;
    const collection = await this.findOwnedCollectionOrThrow(db, userId, collectionId);

    await db.$executeRaw(
      Prisma.sql`
        DELETE FROM "saved_trip_collections"
        WHERE "id" = ${collectionId} AND "userId" = ${userId}
      `,
    );

    return {
      deletedCollectionId: collectionId,
      name: collection.name,
    };
  }

  private buildEligiblePublicTripWhere(id?: string): Prisma.TripWhereInput {
    return {
      ...(id && { id }),
      visibility: 'PUBLIC',
      status: 'OPTIMIZED',
    };
  }

  private buildOwnedSavedTripWhere(userId: string, savedTripId?: string) {
    return {
      ...(savedTripId && { id: savedTripId }),
      userId,
      trip: this.buildEligiblePublicTripWhere(),
    };
  }

  private async ensureEligiblePublicTrip(
    client: any,
    tripId: string,
  ) {
    const trip = await client.trip.findFirst({
      where: this.buildEligiblePublicTripWhere(tripId),
      select: { id: true },
    });

    if (!trip) {
      throw new NotFoundException('Public trip not found');
    }
  }

  private async findOwnedCollectionOrThrow(
    client: any,
    userId: string,
    collectionId: string,
  ) {
    const collection = await this.findOwnedCollectionById(client, userId, collectionId);

    if (!collection) {
      throw new NotFoundException('Saved trip collection not found');
    }

    return collection;
  }

  private async getEngagementSnapshot(
    client: any,
    tripId: string,
    userId: string,
  ) {
    const [
      likeCount,
      commentCount,
      saveCount,
      completionCount,
      likedByMeCount,
      savedByMeCount,
      completedByMeCount,
    ] = await Promise.all([
      client.tripLike.count({ where: { tripId } }),
      client.tripComment.count({ where: { tripId } }),
      client.savedTrip.count({ where: { tripId } }),
      client.tripCompletion.count({ where: { tripId } }),
      client.tripLike.count({ where: { tripId, userId } }),
      client.savedTrip.count({ where: { tripId, userId } }),
      client.tripCompletion.count({ where: { tripId, userId } }),
    ]);

    return {
      likeCount,
      commentCount,
      saveCount,
      completionCount,
      likedByMe: likedByMeCount > 0,
      savedByMe: savedByMeCount > 0,
      completedByMe: completedByMeCount > 0,
    };
  }

  private async getEngagementSnapshots(
    client: any,
    tripIds: string[],
    userId: string,
  ) {
    const engagementByTripId = new Map<string, ReturnType<typeof this.createEmptyEngagement>>();

    for (const tripId of tripIds) {
      engagementByTripId.set(
        tripId,
        await this.getEngagementSnapshot(client, tripId, userId),
      );
    }

    return engagementByTripId;
  }

  private createEmptyEngagement() {
    return {
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      completionCount: 0,
      likedByMe: false,
      savedByMe: false,
      completedByMe: false,
    };
  }

  private async getFeedbackSnapshot(
    client: any,
    tripId: string,
    userId: string,
  ) {
    const completionRows = await client.tripCompletion.findMany({
      where: { tripId },
      select: {
        userId: true,
        feedbackSignals: true,
      },
    });

    const summary = Object.fromEntries(
      PublicTripsService.FEEDBACK_SIGNAL_DEFINITIONS.map((signal) => [signal.key, 0]),
    ) as Record<(typeof PublicTripsService.FEEDBACK_SIGNAL_DEFINITIONS)[number]['key'], number>;

    let mine: string[] = [];

    for (const row of completionRows) {
      const normalizedSignals = this.normalizeStoredFeedbackSignals(row.feedbackSignals);

      if (row.userId === userId) {
        mine = normalizedSignals;
      }

      for (const signal of normalizedSignals) {
        summary[signal] += 1;
      }
    }

    return {
      mine,
      availableSignals: PublicTripsService.FEEDBACK_SIGNAL_DEFINITIONS.map((signal) => ({
        key: signal.key,
        label: signal.label,
      })),
      summary,
    };
  }

  private toPublicTripDetailResponse(
    trip: any,
    engagement: ReturnType<typeof this.createEmptyEngagement>,
    feedback: Awaited<ReturnType<typeof this.getFeedbackSnapshot>>,
  ) {
    const stops = trip.stops.map((stop) => ({
      id: stop.id,
      order: stop.order,
      title: stop.title,
      arrivalTime: stop.arrivalTime,
      departureTime: stop.departureTime,
      travelTimeToNextMin: stop.travelTimeToNextMin,
      estimatedCostTl: stop.estimatedCostTl,
      poi: {
        id: stop.poi.id,
        title: stop.poi.name,
        category: stop.poi.category.toLowerCase(),
        description: stop.poi.description,
        district: stop.poi.district,
        address: stop.poi.address,
        imageUrl: stop.poi.imageUrl,
        source: stop.poi.source,
        coordinates: {
          lat: stop.poi.lat,
          lng: stop.poi.lng,
        },
        suggestedVisitDurationMinutes: stop.poi.avgDurationMin,
        pricing: {
          budgetLevel: stop.poi.budgetLevel.toLowerCase(),
          minTl: stop.poi.estimatedMinCostTl,
          maxTl: stop.poi.estimatedMaxCostTl,
        },
        openingHours: {
          open: stop.poi.openingHoursOpen,
          close: stop.poi.openingHoursClose,
        },
      },
    }));

    const preview = buildTripPreview({
      title: trip.title,
      routeName: trip.routeName,
      categories: trip.categories,
      routeTotalDurationMin: trip.routeTotalDurationMin,
      routeTotalCostTl: trip.routeTotalCostTl,
      stops: stops.map((stop) => ({
        category: stop.poi.category,
        district: stop.poi.district,
        imageUrl: stop.poi.imageUrl,
        coordinates: {
          lat: stop.poi.coordinates.lat,
          lng: stop.poi.coordinates.lng,
        },
      })),
    });
    const socialRationale = this.buildSocialRationale(engagement, feedback);

    return {
      trip: {
        id: trip.id,
        title: trip.title,
        description: trip.description,
        date: trip.date,
        timeStart: trip.timeStart,
        timeEnd: trip.timeEnd,
        budgetTl: trip.budgetTl,
        categories: trip.categories,
        weather: trip.weather,
        walkingToleranceKm: trip.walkingToleranceKm,
        maxPois: trip.maxPois,
        status: trip.status,
        visibility: trip.visibility,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
      },
      preview,
      creator: {
        id: trip.user?.id ?? trip.userId ?? null,
        displayName: trip.user?.displayName ?? null,
      },
      optimization: {
        optimizedAt: trip.optimizedAt,
        routeName: trip.routeName,
        routeTotalDistanceKm: trip.routeTotalDistanceKm,
        routeTotalDurationMin: trip.routeTotalDurationMin,
        routeTotalCostTl: trip.routeTotalCostTl,
        routeAlgorithmUsed: trip.routeAlgorithmUsed,
        routeExplanation: trip.routeExplanation,
        stopCount: stops.length,
        isOptimized: trip.status === 'OPTIMIZED',
      },
      stops,
      engagement,
      feedback,
      socialRationale,
      comments: trip.comments.map((comment) => this.toCommentItem(comment)),
    };
  }

  private buildSocialRationale(
    engagement: ReturnType<typeof this.createEmptyEngagement>,
    feedback: Awaited<ReturnType<typeof this.getFeedbackSnapshot>>,
  ) {
    const items: Array<{
      key: string;
      title: string;
      evidence: string;
      count: number;
    }> = [];

    if (feedback.summary.worth_repeating > 0) {
      items.push({
        key: 'worth_repeating',
        title: 'Worth repeating',
        evidence:
          feedback.summary.worth_repeating === 1
            ? '1 traveler marked it worth repeating.'
            : `${feedback.summary.worth_repeating} travelers marked it worth repeating.`,
        count: feedback.summary.worth_repeating,
      });
    }

    if (feedback.summary.worked_well > 0) {
      items.push({
        key: 'worked_well',
        title: 'Worked well for some travelers',
        evidence:
          feedback.summary.worked_well === 1
            ? '1 traveler said this route worked well.'
            : `${feedback.summary.worked_well} travelers said this route worked well.`,
        count: feedback.summary.worked_well,
      });
    }

    if (feedback.summary.good_for_rainy_weather > 0) {
      items.push({
        key: 'good_for_rainy_weather',
        title: 'Useful in rainy weather',
        evidence:
          feedback.summary.good_for_rainy_weather === 1
            ? '1 traveler found it good for rainy weather.'
            : `${feedback.summary.good_for_rainy_weather} travelers found it good for rainy weather.`,
        count: feedback.summary.good_for_rainy_weather,
      });
    }

    if (engagement.completionCount > 0) {
      items.push({
        key: 'completion_count',
        title: 'People have tried this route',
        evidence:
          engagement.completionCount === 1
            ? '1 traveler marked this route as tried.'
            : `${engagement.completionCount} travelers marked this route as tried.`,
        count: engagement.completionCount,
      });
    }

    if (engagement.saveCount > 0) {
      items.push({
        key: 'save_count',
        title: 'People chose to save it',
        evidence:
          engagement.saveCount === 1
            ? '1 person saved this route for later.'
            : `${engagement.saveCount} people saved this route for later.`,
        count: engagement.saveCount,
      });
    }

    if (engagement.commentCount > 0) {
      items.push({
        key: 'comment_count',
        title: 'It sparked discussion',
        evidence:
          engagement.commentCount === 1
            ? '1 comment was left on this route.'
            : `${engagement.commentCount} comments were left on this route.`,
        count: engagement.commentCount,
      });
    }

    if (engagement.likeCount > 0) {
      items.push({
        key: 'like_count',
        title: 'It drew positive reactions',
        evidence:
          engagement.likeCount === 1
            ? '1 person liked this route.'
            : `${engagement.likeCount} people liked this route.`,
        count: engagement.likeCount,
      });
    }

    const selectedItems = items.slice(0, PublicTripsService.MAX_SOCIAL_RATIONALE_ITEMS);

    if (selectedItems.length === 0) {
      return null;
    }

    return {
      items: selectedItems,
    };
  }

  private toSavedTripItem(
    savedTrip: any,
    collections: Array<{
      id: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }>,
    engagement: ReturnType<typeof this.createEmptyEngagement>,
  ) {
    const trip = savedTrip.trip;
    const preview = buildTripPreview({
      title: trip.title,
      routeName: trip.routeName,
      categories: trip.categories,
      routeTotalDurationMin: trip.routeTotalDurationMin,
      routeTotalCostTl: trip.routeTotalCostTl,
      stops: trip.stops.map((stop) => ({
        category: stop.poi.category.toLowerCase(),
        district: stop.poi.district,
        imageUrl: stop.poi.imageUrl,
        coordinates: {
          lat: stop.poi.lat,
          lng: stop.poi.lng,
        },
      })),
    });

    return {
      savedTripId: savedTrip.id,
      savedAt: savedTrip.createdAt,
      trip: {
        id: trip.id,
        title: trip.title,
        description: trip.description,
        date: trip.date,
        categories: trip.categories,
        weather: trip.weather,
      },
      preview,
      creator: {
        id: trip.user?.id ?? trip.userId ?? null,
        displayName: trip.user?.displayName ?? null,
      },
      optimization: {
        optimizedAt: trip.optimizedAt,
        routeName: trip.routeName,
        routeTotalDurationMin: trip.routeTotalDurationMin,
        routeTotalCostTl: trip.routeTotalCostTl,
      },
      collections: collections.map((collection) =>
        this.toSavedTripCollectionMembership(collection),
      ),
      engagement,
    };
  }

  private async listSavedTripCollections(client: any, userId: string) {
    return (await client.$queryRaw(Prisma.sql`
      SELECT "id", "name", "createdAt", "updatedAt"
      FROM "saved_trip_collections"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" ASC, "name" ASC
    `)) as Array<{
      id: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }

  private async listVisibleSavedTripMembershipRows(client: any, userId: string) {
    return (await client.$queryRaw(Prisma.sql`
      SELECT
        st."id" AS "savedTripId",
        c."id" AS "collectionId",
        c."name" AS "collectionName",
        c."createdAt" AS "collectionCreatedAt",
        c."updatedAt" AS "collectionUpdatedAt"
      FROM "saved_trips" st
      INNER JOIN "trips" t
        ON t."id" = st."tripId"
        AND t."visibility" = 'PUBLIC'
        AND t."status" = 'OPTIMIZED'
      LEFT JOIN "saved_trip_collection_items" sci
        ON sci."savedTripId" = st."id"
      LEFT JOIN "saved_trip_collections" c
        ON c."id" = sci."collectionId"
        AND c."userId" = ${userId}
      WHERE st."userId" = ${userId}
      ORDER BY st."createdAt" DESC, sci."createdAt" ASC
    `)) as Array<{
      savedTripId: string;
      collectionId: string | null;
      collectionName: string | null;
      collectionCreatedAt: Date | null;
      collectionUpdatedAt: Date | null;
    }>;
  }

  private async findOwnedCollectionById(client: any, userId: string, collectionId: string) {
    const collections = (await client.$queryRaw(Prisma.sql`
      SELECT "id", "name", "createdAt", "updatedAt"
      FROM "saved_trip_collections"
      WHERE "id" = ${collectionId} AND "userId" = ${userId}
      LIMIT 1
    `)) as Array<{
      id: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    const [collection] = collections;

    return collection ?? null;
  }

  private async findOwnedCollectionByName(client: any, userId: string, name: string) {
    const collections = (await client.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "saved_trip_collections"
      WHERE "userId" = ${userId} AND "name" = ${name}
      LIMIT 1
    `)) as Array<{
      id: string;
    }>;
    const [collection] = collections;

    return collection ?? null;
  }

  private async findOwnedCollectionsByIds(
    client: any,
    userId: string,
    collectionIds: string[],
  ) {
    return (await client.$queryRaw(Prisma.sql`
      SELECT "id", "name", "createdAt", "updatedAt"
      FROM "saved_trip_collections"
      WHERE "userId" = ${userId}
        AND "id" IN (${Prisma.join(collectionIds)})
      ORDER BY "createdAt" ASC, "name" ASC
    `)) as Array<{
      id: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }

  private toSavedTripCollectionSummary(collection: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  }, savedTripCount: number) {
    return {
      id: collection.id,
      name: collection.name,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      savedTripCount,
    };
  }

  private toSavedTripCollectionMembership(collection: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: collection.id,
      name: collection.name,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  private normalizeCollectionIds(collectionIds: string[]) {
    const normalizedIds = collectionIds.map((collectionId) => collectionId.trim());

    if (normalizedIds.some((collectionId) => !collectionId)) {
      throw new BadRequestException('Collection ids cannot contain empty values');
    }

    return [...new Set(normalizedIds)];
  }

  private normalizeFeedbackSignals(signals: string[]) {
    const normalizedSignals = signals.map((signal) => signal.trim());

    if (normalizedSignals.some((signal) => !signal)) {
      throw new BadRequestException('Feedback signals cannot contain empty values');
    }

    const uniqueSignals = [...new Set(normalizedSignals)];
    const allowedSignals = new Set<string>(
      PublicTripsService.FEEDBACK_SIGNAL_DEFINITIONS.map((signal) => signal.key),
    );
    const invalidSignals = uniqueSignals.filter((signal) => !allowedSignals.has(signal));

    if (invalidSignals.length > 0) {
      throw new BadRequestException(
        `Unsupported feedback signals: ${invalidSignals.join(', ')}`,
      );
    }

    return uniqueSignals;
  }

  private normalizeStoredFeedbackSignals(signals: string[]) {
    const allowedSignals = new Set<string>(
      PublicTripsService.FEEDBACK_SIGNAL_DEFINITIONS.map((signal) => signal.key),
    );

    return [...new Set(signals.filter((signal) => allowedSignals.has(signal)))];
  }

  private toCommentItem(comment: {
    id: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    user?: {
      id: string;
      displayName: string | null;
    } | null;
  }) {
    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: {
        id: comment.user?.id ?? comment.userId,
        displayName: comment.user?.displayName ?? null,
      },
    };
  }
}
