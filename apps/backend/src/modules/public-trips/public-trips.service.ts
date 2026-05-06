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
import { ListForYouTripsQueryDto } from './dto/list-for-you-trips-query.dto';
import { ListSavedTripsQueryDto } from './dto/list-saved-trips-query.dto';
import { UpdateTripFeedbackDto } from './dto/update-trip-feedback.dto';
import { UpdateSavedTripCollectionsDto } from './dto/update-saved-trip-collections.dto';

const FOR_YOU_INTERACTION_WEIGHTS = {
  save: 5,
  completion: 4,
  like: 2,
} as const;

const FOR_YOU_POSITIVE_FEEDBACK_WEIGHTS = {
  worked_well: 2,
  worth_repeating: 3,
  good_for_rainy_weather: 2,
} as const;

const FOR_YOU_BUDGET_BAND_ORDER = ['low', 'medium', 'high'] as const;
const FOR_YOU_DURATION_BAND_ORDER = ['short', 'medium', 'long'] as const;
const FOR_YOU_DISTANCE_BAND_ORDER = ['compact', 'balanced', 'extended'] as const;
const FOR_YOU_STOP_COUNT_BAND_ORDER = ['short', 'balanced', 'full'] as const;

type PublicTripListRecord = Prisma.TripGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        displayName: true;
      };
    };
    stops: {
      include: {
        poi: {
          select: {
            category: true;
            district: true;
            imageUrl: true;
            lat: true;
            lng: true;
          };
        };
      };
    };
  };
}>;

type ForYouRecommendation = {
  kind: 'personalized' | 'fallback';
  primaryReason: string;
  matchedTraits: string[];
};

type ForYouSignalSummary = {
  likes: number;
  saves: number;
  completions: number;
  feedbackSubmissions: number;
};

type ForYouTasteProfile = {
  categoryWeights: Map<string, number>;
  weatherWeights: Map<string, number>;
  budgetBandWeights: Map<string, number>;
  durationBandWeights: Map<string, number>;
  distanceBandWeights: Map<string, number>;
  stopCountBandWeights: Map<string, number>;
  districtWeights: Map<string, number>;
  signalSummary: ForYouSignalSummary;
  seedTripIds: Set<string>;
  excludedTripIds: Set<string>;
  personalizationState: 'personalized' | 'cold_start';
};

type ForYouContribution = {
  score: number;
  trait: string;
  primaryReason: string;
};

type CreatorFollowSummary = {
  followerCount: number;
  isFollowedByMe: boolean;
};

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
    const creatorFollowSummaryByUserId = await this.getCreatorFollowSummaryByUserId(
      db,
      userId,
      [trip.user?.id ?? trip.userId ?? null],
    );

    return this.toPublicTripDetailResponse(
      trip,
      engagement,
      feedback,
      creatorFollowSummaryByUserId,
    );
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
    const creatorFollowSummaryByUserId = await this.getCreatorFollowSummaryByUserId(
      db,
      userId,
      savedTrips.map((savedTrip) => savedTrip.trip.user?.id ?? savedTrip.trip.userId ?? null),
    );

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
            creatorFollowSummaryByUserId,
          )),
    };
  }

  async findForYouTrips(userId: string, query: ListForYouTripsQueryDto) {
    const client = await this.prisma.getClient();
    const db = client as any;
    const limit = query.limit ?? 20;
    const tasteProfile = await this.buildForYouTasteProfile(db, userId);
    const excludedTripIds = [...tasteProfile.excludedTripIds];

    const candidates = (await db.trip.findMany({
      where: {
        ...this.buildEligiblePublicTripWhere(),
        NOT: [{ userId }, ...(excludedTripIds.length > 0 ? [{ id: { in: excludedTripIds } }] : [])],
      },
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
    })) as PublicTripListRecord[];

    const popularityByTripId = await this.getCandidatePopularityByTripId(
      db,
      candidates.map((candidate) => candidate.id),
    );
    const scoredItems = candidates.map((candidate) => {
      const recommendation =
        tasteProfile.personalizationState === 'personalized'
          ? this.buildPersonalizedRecommendation(candidate, tasteProfile)
          : null;
      const popularity = popularityByTripId.get(candidate.id) ?? {
        saves: 0,
        completions: 0,
        likes: 0,
      };

      return {
        trip: candidate,
        recommendation:
          recommendation ?? this.buildFallbackRecommendation(candidate, popularity),
        sortScore:
          recommendation?.sortScore ??
          this.buildFallbackSortScore(candidate, popularity),
      };
    });

    const items = scoredItems
      .sort((left, right) =>
        right.sortScore - left.sortScore ||
        this.compareNullableDates(right.trip.optimizedAt, left.trip.optimizedAt) ||
        this.compareNullableDates(right.trip.createdAt, left.trip.createdAt) ||
        left.trip.id.localeCompare(right.trip.id),
      )
      .slice(0, limit);
    const creatorFollowSummaryByUserId = await this.getCreatorFollowSummaryByUserId(
      db,
      userId,
      items.map((item) => item.trip.user?.id ?? item.trip.userId ?? null),
    );
    const mappedItems = items.map((item) => ({
        ...this.toPublicTripListItem(item.trip, creatorFollowSummaryByUserId),
        recommendation: item.recommendation.payload,
      }));

    return {
      items: mappedItems,
      meta: {
        personalizationState: tasteProfile.personalizationState,
        signalSummary: tasteProfile.signalSummary,
        total: mappedItems.length,
      },
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
    creatorFollowSummaryByUserId: Map<string, CreatorFollowSummary>,
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
      creator: this.toCreatorPayload(
        trip.user?.id ?? trip.userId ?? null,
        trip.user?.displayName ?? null,
        creatorFollowSummaryByUserId,
      ),
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

  private async buildForYouTasteProfile(
    client: any,
    userId: string,
  ): Promise<ForYouTasteProfile> {
    const tripListInclude = {
      trip: {
        include: {
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
    };

    const [savedTrips, completions, likes] = await Promise.all([
      client.savedTrip.findMany({
        where: { userId },
        include: tripListInclude,
      }),
      client.tripCompletion.findMany({
        where: { userId },
        include: tripListInclude,
      }),
      client.tripLike.findMany({
        where: { userId },
        include: tripListInclude,
      }),
    ]);

    const profile: ForYouTasteProfile = {
      categoryWeights: new Map(),
      weatherWeights: new Map(),
      budgetBandWeights: new Map(),
      durationBandWeights: new Map(),
      distanceBandWeights: new Map(),
      stopCountBandWeights: new Map(),
      districtWeights: new Map(),
      signalSummary: {
        likes: 0,
        saves: 0,
        completions: 0,
        feedbackSubmissions: 0,
      },
      seedTripIds: new Set<string>(),
      excludedTripIds: new Set<string>(),
      personalizationState: 'cold_start',
    };

    for (const savedTrip of savedTrips) {
      if (!this.isEligiblePublicTrip(savedTrip.trip)) {
        continue;
      }

      profile.signalSummary.saves += 1;
      profile.seedTripIds.add(savedTrip.tripId);
      profile.excludedTripIds.add(savedTrip.tripId);
      this.applyTripToTasteProfile(
        profile,
        savedTrip.trip,
        FOR_YOU_INTERACTION_WEIGHTS.save,
      );
    }

    for (const completion of completions) {
      if (!this.isEligiblePublicTrip(completion.trip)) {
        continue;
      }

      profile.signalSummary.completions += 1;
      profile.seedTripIds.add(completion.tripId);
      profile.excludedTripIds.add(completion.tripId);
      this.applyTripToTasteProfile(
        profile,
        completion.trip,
        FOR_YOU_INTERACTION_WEIGHTS.completion,
      );

      const positiveSignals = this.normalizeStoredFeedbackSignals(
        completion.feedbackSignals,
      ).filter((signal) => signal in FOR_YOU_POSITIVE_FEEDBACK_WEIGHTS);

      if (positiveSignals.length > 0) {
        profile.signalSummary.feedbackSubmissions += 1;
      }

      for (const signal of positiveSignals) {
        const bonusWeight =
          FOR_YOU_POSITIVE_FEEDBACK_WEIGHTS[
            signal as keyof typeof FOR_YOU_POSITIVE_FEEDBACK_WEIGHTS
          ];
        this.applyTripToTasteProfile(profile, completion.trip, bonusWeight);

        if (signal === 'good_for_rainy_weather') {
          this.addWeight(profile.weatherWeights, 'rainy', bonusWeight + 1);
        }
      }
    }

    for (const like of likes) {
      if (!this.isEligiblePublicTrip(like.trip)) {
        continue;
      }

      profile.signalSummary.likes += 1;
      profile.seedTripIds.add(like.tripId);
      this.applyTripToTasteProfile(
        profile,
        like.trip,
        FOR_YOU_INTERACTION_WEIGHTS.like,
      );
    }

    const strongSignalCount =
      profile.signalSummary.saves +
      profile.signalSummary.completions +
      profile.signalSummary.feedbackSubmissions;

    profile.personalizationState =
      profile.seedTripIds.size >= 2 || strongSignalCount >= 2
        ? 'personalized'
        : 'cold_start';

    return profile;
  }

  private applyTripToTasteProfile(
    profile: ForYouTasteProfile,
    trip: PublicTripListRecord | any,
    weight: number,
  ) {
    const categories = this.normalizeCategoryValues(trip.categories);
    for (const category of categories) {
      this.addWeight(profile.categoryWeights, category, weight);
    }

    const dominantStopCategories = this.getDominantStopCategories(trip.stops ?? []);
    for (const category of dominantStopCategories) {
      this.addWeight(profile.categoryWeights, category, weight * 1.25);
    }

    const district = this.getTopDistrictFromStops(trip.stops ?? []);
    if (district) {
      this.addWeight(profile.districtWeights, district, weight);
    }

    const weather = trip.weather?.trim().toLowerCase();
    if (weather) {
      this.addWeight(profile.weatherWeights, weather, weight);
    }

    const budgetBand = this.getBudgetBand(trip.routeTotalCostTl);
    if (budgetBand) {
      this.addWeight(profile.budgetBandWeights, budgetBand, weight);
    }

    const durationBand = this.getDurationBand(trip.routeTotalDurationMin);
    if (durationBand) {
      this.addWeight(profile.durationBandWeights, durationBand, weight);
    }

    const distanceBand = this.getDistanceBand(trip.routeTotalDistanceKm);
    if (distanceBand) {
      this.addWeight(profile.distanceBandWeights, distanceBand, weight);
    }

    const stopCountBand = this.getStopCountBand((trip.stops ?? []).length);
    if (stopCountBand) {
      this.addWeight(profile.stopCountBandWeights, stopCountBand, weight);
    }
  }

  private buildPersonalizedRecommendation(
    trip: PublicTripListRecord,
    profile: ForYouTasteProfile,
  ) {
    const contributions: ForYouContribution[] = [];
    const candidateCategories = [
      ...new Set([
        ...this.normalizeCategoryValues(trip.categories),
        ...this.getDominantStopCategories(trip.stops),
      ]),
    ];

    for (const category of candidateCategories) {
      const score = profile.categoryWeights.get(category) ?? 0;
      if (score <= 0) {
        continue;
      }

      contributions.push({
        score,
        trait: `category:${category}`,
        primaryReason: `Matches your interest in ${category} public trips.`,
      });
    }

    const weather = trip.weather?.trim().toLowerCase();
    if (weather) {
      const score = (profile.weatherWeights.get(weather) ?? 0) * 1.2;
      if (score > 0) {
        contributions.push({
          score,
          trait: `weather:${weather}`,
          primaryReason:
            weather === 'rainy'
              ? 'Matches the rainy-weather routes you responded well to.'
              : `Matches the ${weather}-weather public trips you engage with.`,
        });
      }
    }

    const budgetBand = this.getBudgetBand(trip.routeTotalCostTl);
    if (budgetBand) {
      const score = (profile.budgetBandWeights.get(budgetBand) ?? 0) * 1.1;
      if (score > 0) {
        contributions.push({
          score,
          trait: `budget:${budgetBand}`,
          primaryReason: `Fits the ${budgetBand}-budget routes you tend to save or complete.`,
        });
      }
    }

    const durationBand = this.getDurationBand(trip.routeTotalDurationMin);
    if (durationBand) {
      const score = profile.durationBandWeights.get(durationBand) ?? 0;
      if (score > 0) {
        contributions.push({
          score,
          trait: `duration:${durationBand}`,
          primaryReason: `Has a ${durationBand} route pace similar to trips you've engaged with.`,
        });
      }
    }

    const distanceBand = this.getDistanceBand(trip.routeTotalDistanceKm);
    if (distanceBand) {
      const score = profile.distanceBandWeights.get(distanceBand) ?? 0;
      if (score > 0) {
        contributions.push({
          score,
          trait: `distance:${distanceBand}`,
          primaryReason: `Matches the ${distanceBand} route distance you usually respond to.`,
        });
      }
    }

    const stopCountBand = this.getStopCountBand(trip.stops.length);
    if (stopCountBand) {
      const score = profile.stopCountBandWeights.get(stopCountBand) ?? 0;
      if (score > 0) {
        contributions.push({
          score,
          trait: `stop-count:${stopCountBand}`,
          primaryReason: `Has a ${stopCountBand} stop count similar to routes you've engaged with.`,
        });
      }
    }

    const district = this.getTopDistrictFromStops(trip.stops);
    if (district) {
      const score = profile.districtWeights.get(district) ?? 0;
      if (score > 0) {
        contributions.push({
          score,
          trait: `district:${district}`,
          primaryReason: `Includes stops around ${district}, similar to public trips you've engaged with.`,
        });
      }
    }

    const rankedContributions = contributions.sort(
      (left, right) =>
        right.score - left.score || left.trait.localeCompare(right.trait),
    );

    if (rankedContributions.length === 0) {
      return null;
    }

    return {
      payload: {
        kind: 'personalized' as const,
        primaryReason: rankedContributions[0].primaryReason,
        matchedTraits: rankedContributions
          .slice(0, 3)
          .map((contribution) => contribution.trait),
      },
      sortScore: rankedContributions.reduce(
        (total, contribution) => total + contribution.score,
        0,
      ),
    };
  }

  private buildFallbackRecommendation(
    trip: PublicTripListRecord,
    popularity: {
      saves: number;
      completions: number;
      likes: number;
    },
  ) {
    const parts: string[] = [];

    if (popularity.saves > 0) {
      parts.push(
        popularity.saves === 1
          ? 'saved by 1 traveler'
          : `saved by ${popularity.saves} travelers`,
      );
    }

    if (popularity.completions > 0) {
      parts.push(
        popularity.completions === 1
          ? 'completed by 1 traveler'
          : `completed by ${popularity.completions} travelers`,
      );
    }

    if (parts.length > 0) {
      return {
        payload: {
          kind: 'fallback' as const,
          primaryReason: `Popular public trip while we learn your taste: ${parts.join(' and ')}.`,
          matchedTraits: ['popular'],
        },
      };
    }

    return {
      payload: {
        kind: 'fallback' as const,
        primaryReason: 'Recently optimized public trip while we learn your taste.',
        matchedTraits: ['recent'],
      },
    };
  }

  private buildFallbackSortScore(
    trip: PublicTripListRecord,
    popularity: {
      saves: number;
      completions: number;
      likes: number;
    },
  ) {
    const popularityScore =
      popularity.saves * 4 + popularity.completions * 3 + popularity.likes * 2;
    const recencyScore = trip.optimizedAt
      ? trip.optimizedAt.getTime() / 1_000_000_000_000
      : 0;

    return popularityScore + recencyScore;
  }

  private async getCandidatePopularityByTripId(client: any, tripIds: string[]) {
    const popularityByTripId = new Map<
      string,
      {
        saves: number;
        completions: number;
        likes: number;
      }
    >();

    if (tripIds.length === 0) {
      return popularityByTripId;
    }

    const [saveRows, completionRows, likeRows] = await Promise.all([
      client.savedTrip.groupBy({
        by: ['tripId'],
        where: { tripId: { in: tripIds } },
        _count: { _all: true },
      }),
      client.tripCompletion.groupBy({
        by: ['tripId'],
        where: { tripId: { in: tripIds } },
        _count: { _all: true },
      }),
      client.tripLike.groupBy({
        by: ['tripId'],
        where: { tripId: { in: tripIds } },
        _count: { _all: true },
      }),
    ]);

    for (const tripId of tripIds) {
      popularityByTripId.set(tripId, {
        saves: 0,
        completions: 0,
        likes: 0,
      });
    }

    for (const row of saveRows) {
      popularityByTripId.set(row.tripId, {
        ...(popularityByTripId.get(row.tripId) ?? {
          saves: 0,
          completions: 0,
          likes: 0,
        }),
        saves: row._count._all,
      });
    }

    for (const row of completionRows) {
      popularityByTripId.set(row.tripId, {
        ...(popularityByTripId.get(row.tripId) ?? {
          saves: 0,
          completions: 0,
          likes: 0,
        }),
        completions: row._count._all,
      });
    }

    for (const row of likeRows) {
      popularityByTripId.set(row.tripId, {
        ...(popularityByTripId.get(row.tripId) ?? {
          saves: 0,
          completions: 0,
          likes: 0,
        }),
        likes: row._count._all,
      });
    }

    return popularityByTripId;
  }

  private toPublicTripListItem(
    trip: PublicTripListRecord,
    creatorFollowSummaryByUserId: Map<string, CreatorFollowSummary>,
  ) {
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
      id: trip.id,
      title: trip.title,
      description: trip.description,
      categories: trip.categories,
      routeTotalDurationMin: trip.routeTotalDurationMin,
      routeTotalCostTl: trip.routeTotalCostTl,
      optimizedAt: trip.optimizedAt,
      preview,
      creator: this.toCreatorPayload(
        trip.user?.id ?? trip.userId ?? null,
        trip.user?.displayName ?? null,
        creatorFollowSummaryByUserId,
      ),
    };
  }

  private isEligiblePublicTrip(trip: {
    visibility: string;
    status: string;
  }) {
    return trip.visibility === 'PUBLIC' && trip.status === 'OPTIMIZED';
  }

  private normalizeCategoryValues(categories: string[]) {
    return [...new Set(categories.map((category) => category.trim().toLowerCase()).filter(Boolean))];
  }

  private getDominantStopCategories(
    stops: Array<{
      poi: {
        category: string;
      };
    }>,
  ) {
    const counts = new Map<string, number>();

    for (const stop of stops) {
      const category = stop.poi.category.trim().toLowerCase();
      if (!category) {
        continue;
      }

      counts.set(category, (counts.get(category) ?? 0) + 1);
    }

    const topCount = Math.max(0, ...counts.values());
    if (topCount === 0) {
      return [];
    }

    return [...counts.entries()]
      .filter(([, count]) => count === topCount)
      .map(([category]) => category)
      .sort((left, right) => left.localeCompare(right));
  }

  private getTopDistrictFromStops(
    stops: Array<{
      poi: {
        district: string | null;
      };
    }>,
  ) {
    const counts = new Map<string, number>();

    for (const stop of stops) {
      const district = stop.poi.district?.trim();
      if (!district) {
        continue;
      }

      counts.set(district, (counts.get(district) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
  }

  private getBudgetBand(value: number | null) {
    if (value === null) {
      return null;
    }

    if (value <= 2000) {
      return FOR_YOU_BUDGET_BAND_ORDER[0];
    }

    if (value <= 6000) {
      return FOR_YOU_BUDGET_BAND_ORDER[1];
    }

    return FOR_YOU_BUDGET_BAND_ORDER[2];
  }

  private getDurationBand(value: number | null) {
    if (value === null) {
      return null;
    }

    if (value <= 180) {
      return FOR_YOU_DURATION_BAND_ORDER[0];
    }

    if (value <= 360) {
      return FOR_YOU_DURATION_BAND_ORDER[1];
    }

    return FOR_YOU_DURATION_BAND_ORDER[2];
  }

  private getDistanceBand(value: number | null) {
    if (value === null) {
      return null;
    }

    if (value <= 3) {
      return FOR_YOU_DISTANCE_BAND_ORDER[0];
    }

    if (value <= 8) {
      return FOR_YOU_DISTANCE_BAND_ORDER[1];
    }

    return FOR_YOU_DISTANCE_BAND_ORDER[2];
  }

  private getStopCountBand(value: number) {
    if (value <= 0) {
      return null;
    }

    if (value <= 3) {
      return FOR_YOU_STOP_COUNT_BAND_ORDER[0];
    }

    if (value <= 5) {
      return FOR_YOU_STOP_COUNT_BAND_ORDER[1];
    }

    return FOR_YOU_STOP_COUNT_BAND_ORDER[2];
  }

  private addWeight(weights: Map<string, number>, key: string, amount: number) {
    weights.set(key, (weights.get(key) ?? 0) + amount);
  }

  private compareNullableDates(left: Date | null, right: Date | null) {
    const leftValue = left?.getTime() ?? 0;
    const rightValue = right?.getTime() ?? 0;

    return leftValue - rightValue;
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
    creatorFollowSummaryByUserId: Map<string, CreatorFollowSummary>,
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
      creator: this.toCreatorPayload(
        trip.user?.id ?? trip.userId ?? null,
        trip.user?.displayName ?? null,
        creatorFollowSummaryByUserId,
      ),
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

  private toCreatorPayload(
    creatorId: string | null,
    displayName: string | null,
    creatorFollowSummaryByUserId: Map<string, CreatorFollowSummary>,
  ) {
    const followSummary = creatorId
      ? creatorFollowSummaryByUserId.get(creatorId)
      : null;

    return {
      id: creatorId,
      displayName,
      isFollowedByMe: followSummary?.isFollowedByMe ?? false,
      followerCount: followSummary?.followerCount ?? 0,
    };
  }

  private async getCreatorFollowSummaryByUserId(
    client: any,
    currentUserId: string,
    creatorIds: Array<string | null | undefined>,
  ) {
    const normalizedCreatorIds = [...new Set(creatorIds.filter(Boolean))] as string[];

    if (normalizedCreatorIds.length === 0) {
      return new Map<string, CreatorFollowSummary>();
    }

    const followerCountRows = (await client.$queryRaw(Prisma.sql`
      SELECT "followingId" AS "userId", COUNT(*)::int AS "followerCount"
      FROM "user_follows"
      WHERE "followingId" IN (${Prisma.join(normalizedCreatorIds)})
      GROUP BY "followingId"
    `)) as Array<{
      userId: string;
      followerCount: number;
    }>;

    const followedRows = (await client.$queryRaw(Prisma.sql`
      SELECT "followingId" AS "userId"
      FROM "user_follows"
      WHERE "followerId" = ${currentUserId}
        AND "followingId" IN (${Prisma.join(normalizedCreatorIds)})
    `)) as Array<{
      userId: string;
    }>;

    const summaryByUserId = new Map<string, CreatorFollowSummary>();

    for (const creatorId of normalizedCreatorIds) {
      summaryByUserId.set(creatorId, {
        followerCount: 0,
        isFollowedByMe: false,
      });
    }

    for (const row of followerCountRows) {
      summaryByUserId.set(row.userId, {
        ...(summaryByUserId.get(row.userId) ?? {
          followerCount: 0,
          isFollowedByMe: false,
        }),
        followerCount: row.followerCount,
      });
    }

    for (const row of followedRows) {
      summaryByUserId.set(row.userId, {
        ...(summaryByUserId.get(row.userId) ?? {
          followerCount: 0,
          isFollowedByMe: false,
        }),
        isFollowedByMe: true,
      });
    }

    return summaryByUserId;
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
