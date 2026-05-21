import { Injectable, NotFoundException } from '@nestjs/common';
import { PointOfInterest, Prisma } from '@prisma/client';
import { OptimizerService } from '../optimizer/optimizer.service';
import {
  OptimizerOptimizeRequest,
  OptimizerOptimizeResponse,
} from '../optimizer/optimizer.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { ExploreTripsQueryDto } from './dto/explore-trips-query.dto';
import { buildTripPreview, type TripPreview } from './trip-preview';
import { UpdateTripDto } from './dto/update-trip.dto';

// Maps the backend's broader interest labels to the optimizer's POICategory enum.
// Mirrors the same map in optimizer.service.ts so both sides stay consistent.
const CATEGORY_MAP: Record<string, string[]> = {
  historical: ['historical'],
  scenic: ['scenic'],
  food: ['food'],
  shopping: ['shopping'],
  nature: ['nature'],
  neighborhood: ['neighborhood'],
  entertainment: ['entertainment'],
  culture: ['historical','neighborhood'],
  history: ['historical'],
  museums: ['historical'],
  coffee: ['food'],
  nightlife: ['food', 'entertainment'],
};

const BUDGET_LEVEL_TO_TL: Record<string, number> = {
  low: 2000,
  medium: 6000,
  high: 20000,
};

const DEFAULT_OPTIMIZER_TIME_START = '09:00';
const DEFAULT_OPTIMIZER_TIME_END = '21:00';
const DEFAULT_OPTIMIZER_WALKING_TOLERANCE_KM = 3.0;
const DEFAULT_OPTIMIZER_BUDGET_TL = 6000;
const MAX_CANDIDATE_POIS = 20;
// When the destination doesn't match any known district (typo, freeform input,
// etc.) we fall back to a geographic radius around the city centre so the user
// still gets a route. Anchor is Sultanahmet (Istanbul historic centre).
const FALLBACK_RADIUS_KM = 15;
const ISTANBUL_CENTER = { lat: 41.0082, lng: 28.9784 };
// Rough budget per POI when sizing the candidate pool against the user's time
// window: 60 min visit + 30 min transit/buffer. Used only to set how many
// candidates the optimizer has to choose from — the optimizer still makes the
// final pick based on real time/budget/walking constraints.
const MINUTES_PER_POI_BUDGET = 90;
const AREA_RADIUS_EXPANSION_TIERS_KM = [1.5, 3];
const DISTRICT_RADIUS_EXPANSION_TIERS_KM = [3, 5];
const EMPTY_RESULT_RADIUS_EXPANSION_TIERS_KM = [5, 8, 12];
const KNOWN_DESTINATION_FALLBACK_RADIUS_TIERS_KM = [5, 8];
const DEFAULT_MAX_STOPS = 4;
const MAX_DEFAULT_STOPS = 6;

const DISTRICT_FALLBACK_GROUPS: Record<string, string[]> = {
  Şişli: ['Şişli', 'Beyoğlu', 'Beşiktaş'],
  Beyoğlu: ['Beyoğlu', 'Şişli', 'Beşiktaş', 'Fatih'],
  Beşiktaş: ['Beşiktaş', 'Şişli', 'Beyoğlu', 'Sarıyer'],
  Fatih: ['Fatih', 'Beyoğlu', 'Eyüpsultan', 'Zeytinburnu'],
  Kadıköy: ['Kadıköy'],
  Üsküdar: ['Üsküdar', 'Kadıköy'],
  Beykoz: ['Beykoz', 'Üsküdar'],
  Sarıyer: ['Sarıyer', 'Beşiktaş'],
  Eyüpsultan: ['Eyüpsultan', 'Fatih', 'Beyoğlu'],
  Zeytinburnu: ['Zeytinburnu', 'Fatih'],
  Bakırköy: ['Bakırköy', 'Zeytinburnu'],
  Ataşehir: ['Ataşehir', 'Kadıköy', 'Üsküdar'],
  Adalar: ['Adalar'],
  Şile: ['Şile'],
  Kartal: ['Kartal', 'Kadıköy'],
  Küçükçekmece: ['Küçükçekmece', 'Bakırköy'],
};

type DestinationAlias = {
  label: string;
  aliases: string[];
  district: string;
  anchor: { lat: number; lng: number };
  radiusTiersKm: number[];
  fallbackDistricts?: string[];
  fallbackRadiusTiersKm?: number[];
};

const DESTINATION_ALIASES: DestinationAlias[] = [
  {
    label: 'Nişantaşı',
    aliases: [
      'nişantaşı',
      'nisantasi',
      'nishantashi',
      'teşvikiye',
      'tesvikiye',
    ],
    district: 'Şişli',
    anchor: { lat: 41.049464, lng: 28.992018 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Şişli', 'Beyoğlu', 'Beşiktaş'],
  },
  {
    label: 'Sultanahmet',
    aliases: ['sultanahmet', 'old city', 'ayasofya', 'blue mosque'],
    district: 'Fatih',
    anchor: { lat: 41.006329, lng: 28.975705 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Fatih', 'Beyoğlu'],
  },
  {
    label: 'Beyazıt',
    aliases: [
      'beyazıt',
      'beyazit',
      'grand bazaar',
      'kapalı çarşı',
      'kapali carsi',
    ],
    district: 'Fatih',
    anchor: { lat: 41.010685, lng: 28.968068 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Fatih', 'Beyoğlu'],
  },
  {
    label: 'Eminönü',
    aliases: [
      'eminönü',
      'eminonu',
      'spice bazaar',
      'mısır çarşısı',
      'misir carsisi',
    ],
    district: 'Fatih',
    anchor: { lat: 41.014936, lng: 28.965977 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Fatih', 'Beyoğlu'],
  },
  {
    label: 'Balat',
    aliases: ['balat', 'fener'],
    district: 'Fatih',
    anchor: { lat: 41.029211, lng: 28.948498 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Fatih', 'Beyoğlu', 'Eyüpsultan'],
  },
  {
    label: 'Karaköy',
    aliases: ['karaköy', 'karakoy', 'galataport'],
    district: 'Beyoğlu',
    anchor: { lat: 41.027352, lng: 28.985484 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Beyoğlu', 'Şişli', 'Beşiktaş', 'Fatih'],
  },
  {
    label: 'Galata',
    aliases: ['galata', 'galata tower', 'galata kulesi'],
    district: 'Beyoğlu',
    anchor: { lat: 41.025569, lng: 28.974129 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Beyoğlu', 'Şişli', 'Beşiktaş', 'Fatih'],
  },
  {
    label: 'Taksim',
    aliases: ['taksim', 'istiklal', 'beyoğlu center', 'beyoglu center'],
    district: 'Beyoğlu',
    anchor: { lat: 41.037002, lng: 28.985092 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Beyoğlu', 'Şişli', 'Beşiktaş'],
  },
  {
    label: 'Asmalımescit',
    aliases: ['asmalımescit', 'asmalimescit', 'pera'],
    district: 'Beyoğlu',
    anchor: { lat: 41.030909, lng: 28.97506 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Beyoğlu', 'Şişli', 'Beşiktaş', 'Fatih'],
  },
  {
    label: 'Beşiktaş',
    aliases: ['beşiktaş', 'besiktas', 'beşiktaş iskelesi', 'besiktas iskelesi'],
    district: 'Beşiktaş',
    anchor: { lat: 41.041212, lng: 29.007308 },
    radiusTiersKm: DISTRICT_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Beşiktaş', 'Şişli', 'Beyoğlu'],
  },
  {
    label: 'Ortaköy',
    aliases: ['ortaköy', 'ortakoy'],
    district: 'Beşiktaş',
    anchor: { lat: 41.047215, lng: 29.026948 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Beşiktaş', 'Şişli', 'Beyoğlu'],
  },
  {
    label: 'Bebek',
    aliases: ['bebek'],
    district: 'Beşiktaş',
    anchor: { lat: 41.077744, lng: 29.041629 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Beşiktaş', 'Sarıyer'],
  },
  {
    label: 'Kadıköy',
    aliases: ['kadıköy', 'kadikoy', 'kadıköy çarşı', 'kadikoy carsi'],
    district: 'Kadıköy',
    anchor: { lat: 40.990468, lng: 29.029171 },
    radiusTiersKm: DISTRICT_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Kadıköy'],
  },
  {
    label: 'Moda',
    aliases: ['moda', 'moda sahili'],
    district: 'Kadıköy',
    anchor: { lat: 40.980008, lng: 29.022831 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Kadıköy'],
  },
  {
    label: 'Bağdat Caddesi',
    aliases: ['bağdat caddesi', 'bagdat caddesi', 'bagdat street'],
    district: 'Kadıköy',
    anchor: { lat: 40.95884, lng: 29.083769 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Kadıköy', 'Ataşehir'],
  },
  {
    label: 'Kuzguncuk',
    aliases: ['kuzguncuk'],
    district: 'Üsküdar',
    anchor: { lat: 41.036122, lng: 29.037264 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Üsküdar', 'Kadıköy'],
  },
  {
    label: 'Kanlıca',
    aliases: ['kanlıca', 'kanlica'],
    district: 'Beykoz',
    anchor: { lat: 41.099008, lng: 29.073629 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Beykoz', 'Üsküdar'],
  },
  {
    label: 'Bomonti',
    aliases: ['bomonti', 'bomontiada'],
    district: 'Şişli',
    anchor: { lat: 41.0544, lng: 28.9847 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Şişli', 'Beyoğlu', 'Beşiktaş'],
  },
  {
    label: 'Eyüp',
    aliases: ['eyüp', 'eyup', 'pierre loti'],
    district: 'Eyüpsultan',
    anchor: { lat: 41.047849, lng: 28.933759 },
    radiusTiersKm: AREA_RADIUS_EXPANSION_TIERS_KM,
    fallbackDistricts: ['Eyüpsultan', 'Fatih', 'Beyoğlu'],
  },
];

type TripDetailRecord = Prisma.TripGetPayload<{
  include: {
    stops: {
      include: {
        poi: true;
      };
    };
  };
}>;

type TripListRecord = Prisma.TripGetPayload<{
  include: {
    _count: {
      select: {
        stops: true;
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

type ExploreTripRecord = Prisma.TripGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        displayName: true;
        avatarUrl: true;
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

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly optimizerService: OptimizerService,
  ) {}

  async create(userId: string, payload: CreateTripDto) {
    const client = await this.prisma.getClient();

    const trip = await client.trip.create({
      data: {
        userId,
        title: payload.title,
        destination: payload.destination,
        description: payload.description ?? null,
        date: new Date(payload.date),
        timeStart: payload.startTime ?? null,
        timeEnd: payload.endTime ?? null,
        budgetTl: payload.budgetTl ?? null,
        categories: payload.categories ?? [],
        weather: payload.weather ?? null,
        walkingToleranceKm: payload.maxWalkingDistanceKm ?? null,
        maxPois: payload.maxStops ?? null,
        visibility: payload.visibility ?? 'PRIVATE',
      },
    });

    return this.findOne(userId, trip.id);
  }

  async findAll(userId: string) {
    const client = await this.prisma.getClient();

    const trips = await client.trip.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { stops: true } },
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
    });

    const tripIds = trips.map((trip) => trip.id);
    const engagementByTripId = await this.getBatchEngagement(client, tripIds, userId);

    return trips.map((trip) => ({
      ...this.toTripListItem(trip as TripListRecord),
      engagement: engagementByTripId.get(trip.id) ?? {
        likeCount: 0,
        commentCount: 0,
        saveCount: 0,
        completionCount: 0,
        likedByMe: false,
        savedByMe: false,
        completedByMe: false,
      },
    }));
  }

  async findExploreTrips(query: ExploreTripsQueryDto, userId: string | null = null) {
    const client = await this.prisma.getClient();
    const trimmedQuery = query.q?.trim();
    const normalizedQuery = trimmedQuery ? trimmedQuery : null;
    const normalizedCategory = query.category?.trim().toLowerCase() ?? null;
    const normalizedWeather = query.weather?.trim().toLowerCase() ?? null;
    const limit = query.limit ?? 20;

    const where: Prisma.TripWhereInput = {
      visibility: 'PUBLIC',
      status: 'OPTIMIZED',
      ...(query.creatorId && { userId: query.creatorId }),
      ...(normalizedQuery && {
        OR: [
          { title: { contains: normalizedQuery, mode: 'insensitive' } },
          { description: { contains: normalizedQuery, mode: 'insensitive' } },
          { routeName: { contains: normalizedQuery, mode: 'insensitive' } },
          {
            user: {
              displayName: { contains: normalizedQuery, mode: 'insensitive' },
            },
          },
        ],
      }),
      ...(normalizedCategory && { categories: { has: normalizedCategory } }),
      ...(normalizedWeather && { weather: normalizedWeather }),
      ...((query.budgetMinTl !== undefined ||
        query.budgetMaxTl !== undefined) && {
        routeTotalCostTl: {
          ...(query.budgetMinTl !== undefined && { gte: query.budgetMinTl }),
          ...(query.budgetMaxTl !== undefined && { lte: query.budgetMaxTl }),
        },
      }),
    };

    const [trips, total, categoryRows] = await Promise.all([
      client.trip.findMany({
        where,
        orderBy: [{ optimizedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
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
      }),
      client.trip.count({ where }),
      client.trip.findMany({
        where: {
          visibility: 'PUBLIC',
          status: 'OPTIMIZED',
        },
        select: {
          categories: true,
        },
      }),
    ]);

    const availableCategories = [
      ...new Set(
        categoryRows
          .flatMap((trip) => trip.categories)
          .map((category) => category.trim().toLowerCase())
          .filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right));

    const tripIds = trips.map((trip) => trip.id);
    const engagementByTripId = await this.getBatchEngagement(client, tripIds, userId);

    return {
      items: trips.map((trip) => ({
        ...this.toExploreTripItem(trip as ExploreTripRecord),
        engagement: engagementByTripId.get(trip.id) ?? {
          likeCount: 0,
          commentCount: 0,
          saveCount: 0,
          completionCount: 0,
          likedByMe: false,
          savedByMe: false,
          completedByMe: false,
        },
      })),
      meta: {
        total,
        availableCategories,
        appliedFilters: {
          q: normalizedQuery,
          category: normalizedCategory,
          budgetMinTl: query.budgetMinTl ?? null,
          budgetMaxTl: query.budgetMaxTl ?? null,
          limit,
        },
      },
    };
  }

  private async getBatchEngagement(
    client: any,
    tripIds: string[],
    userId: string | null,
  ) {
    if (tripIds.length === 0) {
      return new Map<string, { likeCount: number; commentCount: number; saveCount: number; completionCount: number; likedByMe: boolean; savedByMe: boolean; completedByMe: boolean }>();
    }

    const [likes, comments, saves, completions, myLikes, mySaves, myCompletions] = await Promise.all([
      client.tripLike.findMany({ where: { tripId: { in: tripIds } }, select: { tripId: true } }),
      client.tripComment.findMany({ where: { tripId: { in: tripIds } }, select: { tripId: true } }),
      client.savedTrip.findMany({ where: { tripId: { in: tripIds } }, select: { tripId: true } }),
      client.tripCompletion.findMany({ where: { tripId: { in: tripIds } }, select: { tripId: true } }),
      userId ? client.tripLike.findMany({ where: { tripId: { in: tripIds }, userId }, select: { tripId: true } }) : Promise.resolve([]),
      userId ? client.savedTrip.findMany({ where: { tripId: { in: tripIds }, userId }, select: { tripId: true } }) : Promise.resolve([]),
      userId ? client.tripCompletion.findMany({ where: { tripId: { in: tripIds }, userId }, select: { tripId: true } }) : Promise.resolve([]),
    ]);

    const countBy = (rows: Array<{ tripId: string }>) => {
      const map = new Map<string, number>();
      for (const { tripId } of rows) {
        map.set(tripId, (map.get(tripId) ?? 0) + 1);
      }
      return map;
    };

    const likeCountMap = countBy(likes);
    const commentCountMap = countBy(comments);
    const saveCountMap = countBy(saves);
    const completionCountMap = countBy(completions);
    const likedSet = new Set<string>((myLikes as Array<{ tripId: string }>).map((r) => r.tripId));
    const savedSet = new Set<string>((mySaves as Array<{ tripId: string }>).map((r) => r.tripId));
    const completedSet = new Set<string>((myCompletions as Array<{ tripId: string }>).map((r) => r.tripId));

    return new Map(
      tripIds.map((tripId) => [
        tripId,
        {
          likeCount: likeCountMap.get(tripId) ?? 0,
          commentCount: commentCountMap.get(tripId) ?? 0,
          saveCount: saveCountMap.get(tripId) ?? 0,
          completionCount: completionCountMap.get(tripId) ?? 0,
          likedByMe: likedSet.has(tripId),
          savedByMe: savedSet.has(tripId),
          completedByMe: completedSet.has(tripId),
        },
      ]),
    );
  }

  async findOne(userId: string, id: string) {
    const client = await this.prisma.getClient();

    const trip = (await this.getOwnedTripOrThrow(client, userId, id, {
      stops: {
        orderBy: { order: 'asc' },
        include: { poi: true },
      },
    })) as TripDetailRecord;

    return this.toTripDetailResponse(trip);
  }

  async update(userId: string, id: string, payload: UpdateTripDto) {
    const client = await this.prisma.getClient();

    await this.getOwnedTripOrThrow(client, userId, id);

    await client.trip.update({
      where: { id },
      data: {
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.destination !== undefined && {
          destination: payload.destination,
        }),
        ...(payload.description !== undefined && {
          description: payload.description,
        }),
        ...(payload.date !== undefined && { date: new Date(payload.date) }),
        ...(payload.startTime !== undefined && {
          timeStart: payload.startTime,
        }),
        ...(payload.endTime !== undefined && { timeEnd: payload.endTime }),
        ...(payload.budgetTl !== undefined && { budgetTl: payload.budgetTl }),
        ...(payload.categories !== undefined && {
          categories: payload.categories,
        }),
        ...(payload.weather !== undefined && { weather: payload.weather }),
        ...(payload.maxWalkingDistanceKm !== undefined && {
          walkingToleranceKm: payload.maxWalkingDistanceKm,
        }),
        ...(payload.maxStops !== undefined && { maxPois: payload.maxStops }),
        ...(payload.visibility !== undefined && {
          visibility: payload.visibility,
        }),
        ...(payload.coverImageUrl !== undefined && {
          coverImageUrl: payload.coverImageUrl ?? null,
        }),
      },
    });

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string) {
    const client = await this.prisma.getClient();

    await this.getOwnedTripOrThrow(client, userId, id);

    await client.trip.delete({ where: { id } });

    return { deleted: true, id };
  }

  private affordableBudgetLevels(budgetTl: number): string[] {
    // Always include LOW. Add MEDIUM if budget >= 2000, HIGH if >= 6000.
    const levels: string[] = ['LOW'];
    if (budgetTl >= 2000) levels.push('MEDIUM');
    if (budgetTl >= 6000) levels.push('HIGH');
    return levels;
  }

  async optimize(userId: string, id: string) {
    const client = await this.prisma.getClient();

    const trip = await this.getOwnedTripOrThrow(client, userId, id);
    const optimizerCategories = this.normalizeTripCategories(trip.categories);
    const dbCategories = this.toDbCategories(optimizerCategories);
    const affordableLevels = trip.budgetTl
      ? this.affordableBudgetLevels(trip.budgetTl)
      : ['LOW', 'MEDIUM', 'HIGH'];

    const poiWhere: Prisma.PointOfInterestWhereInput = {
      ...(dbCategories.length > 0 && {
        category: { in: dbCategories as never[] },
      }),
      budgetLevel: { in: affordableLevels as never[] },
    };

    const candidatePoiPool = await client.pointOfInterest.findMany({
      where: poiWhere,
      orderBy: [
        { category: 'asc' },
        { avgDurationMin: 'asc' },
        { name: 'asc' },
      ],
    });
    const destinationAnchorPool = await client.pointOfInterest.findMany({
      orderBy: [
        { category: 'asc' },
        { avgDurationMin: 'asc' },
        { name: 'asc' },
      ],
    });

    const effectiveMaxPois = this.resolveMaxPois(
      trip.maxPois,
      trip.categories,
      trip.timeStart,
      trip.timeEnd,
    );
    const targetCandidateCount = Math.max(
      effectiveMaxPois,
      this.targetCandidateCountForTimeWindow(
        trip.timeStart ?? DEFAULT_OPTIMIZER_TIME_START,
        trip.timeEnd ?? DEFAULT_OPTIMIZER_TIME_END,
      ),
    );
    const destinationCandidates = await this.selectCandidatesForDestination(
      candidatePoiPool,
      trip.destination,
      targetCandidateCount,
      destinationAnchorPool,
    );
    const pois = this.balanceCandidatesByCategory(
      destinationCandidates,
      optimizerCategories,
      MAX_CANDIDATE_POIS,
    );

    const destinationAnchor = this.resolveDestinationAnchorFromPool(
      destinationAnchorPool,
      trip.destination,
    );

    const candidatePois = pois.map((poi) =>
      this.mapPoiToOptimizerCandidate(poi),
    );
    const effectiveBudgetTl = this.resolveOptimizerBudgetTl(
      trip.budgetTl,
      affordableLevels,
    );
    const optimizerRequest: OptimizerOptimizeRequest = {
      trip_id: trip.id,
      date: trip.date.toISOString().split('T')[0],
      preferences: {
        categories: optimizerCategories,
        time_start: trip.timeStart ?? DEFAULT_OPTIMIZER_TIME_START,
        time_end: trip.timeEnd ?? DEFAULT_OPTIMIZER_TIME_END,
        budget_tl: effectiveBudgetTl,
        walking_tolerance_km:
          trip.walkingToleranceKm ?? DEFAULT_OPTIMIZER_WALKING_TOLERANCE_KM,
        max_pois: effectiveMaxPois,
        weather: this.normalizeWeather(trip.weather),
      },
      ...(destinationAnchor && { destination_anchor: destinationAnchor }),
      candidate_pois: candidatePois,
    };

    const optimizerResult =
      candidatePois.length > 0
        ? await this.optimizerService.callOptimize(optimizerRequest)
        : this.buildNoFeasibleRouteResult(
            optimizerRequest,
            'backend_no_candidates',
          );
    const routeExplanation = this.buildRouteExplanation(
      trip,
      optimizerResult,
      pois,
    );

    await client.$transaction(async (tx) => {
      await tx.tripStop.deleteMany({
        where: { tripId: trip.id },
      });

      if (optimizerResult.route.stops.length > 0) {
        await tx.tripStop.createMany({
          data: optimizerResult.route.stops.map((stop, index) => ({
            tripId: trip.id,
            poiId: stop.poi_id,
            order: index + 1,
            title: stop.name,
            arrivalTime: stop.arrival_time,
            departureTime: stop.departure_time,
            travelTimeToNextMin: stop.travel_time_to_next_minutes ?? null,
            estimatedCostTl: stop.estimated_cost_tl,
          })),
        });
      }

      await tx.trip.update({
        where: { id: trip.id },
        data: {
          status:
            optimizerResult.route.stops.length > 0 ? 'OPTIMIZED' : 'FAILED',
          optimizedAt: new Date(optimizerResult.generated_at),
          routeName: optimizerResult.route.route_name,
          routeTotalDistanceKm: optimizerResult.route.total_distance_km,
          routeTotalDurationMin: optimizerResult.route.total_duration_minutes,
          routeTotalCostTl: optimizerResult.route.total_cost_tl,
          routeAlgorithmUsed: optimizerResult.algorithm_used,
          routeExplanation,
        },
      });
    });

    return this.findOne(userId, trip.id);
  }

  private async getOwnedTripOrThrow(
    client: Awaited<ReturnType<PrismaService['getClient']>>,
    userId: string,
    tripId: string,
    include?: Prisma.TripInclude,
  ) {
    const trip = await client.trip.findFirst({
      where: {
        id: tripId,
        userId,
      },
      include,
    });

    if (!trip) {
      throw new NotFoundException(`Trip not found: "${tripId}"`);
    }

    return trip;
  }

  private normalizeTripCategories(categories: string[]): string[] {
    return [
      ...new Set(
        categories.flatMap((category) => CATEGORY_MAP[category] ?? [category]),
      ),
    ];
  }

  private toDbCategories(categories: string[]): string[] {
    return categories.map((category) => category.toUpperCase());
  }

  private balanceCandidatesByCategory(
    candidates: PointOfInterest[],
    preferredCategories: string[],
    limit: number,
  ): PointOfInterest[] {
    if (candidates.length <= limit) {
      return candidates;
    }

    const orderedCategories = [
      ...new Set(
        preferredCategories.map((category) => category.trim().toUpperCase()),
      ),
    ].filter(Boolean);

    if (orderedCategories.length === 0) {
      return candidates.slice(0, limit);
    }

    const buckets = new Map<string, PointOfInterest[]>();
    for (const category of orderedCategories) {
      buckets.set(
        category,
        candidates.filter((poi) => String(poi.category) === category),
      );
    }

    const selected: PointOfInterest[] = [];
    const selectedIds = new Set<string>();
    const bucketOffsets = new Map<string, number>();

    const addCandidate = (poi: PointOfInterest | undefined) => {
      if (!poi || selectedIds.has(poi.id) || selected.length >= limit) {
        return;
      }
      selected.push(poi);
      selectedIds.add(poi.id);
    };

    // First guarantee each requested category gets represented when a matching
    // POI exists. This prevents dense categories like Fatih historical sights
    // from pushing scarce categories like food out of the 20-candidate cap.
    for (const category of orderedCategories) {
      const firstMatch = buckets.get(category)?.[0];
      addCandidate(firstMatch);
      if (firstMatch) {
        bucketOffsets.set(category, 1);
      }
    }

    // Then fill remaining slots round-robin across the requested categories so
    // the optimizer receives a diverse pool while keeping the DB ordering inside
    // each category.
    let addedInPass = true;
    while (selected.length < limit && addedInPass) {
      addedInPass = false;
      for (const category of orderedCategories) {
        const bucket = buckets.get(category) ?? [];
        const offset = bucketOffsets.get(category) ?? 0;
        const next = bucket[offset];
        if (next) {
          addCandidate(next);
          bucketOffsets.set(category, offset + 1);
          addedInPass = true;
        }
        if (selected.length >= limit) {
          break;
        }
      }
    }

    // If some slots remain because selected categories were sparse, preserve
    // the original candidate ordering for the rest.
    for (const candidate of candidates) {
      addCandidate(candidate);
    }

    return selected;
  }

  private resolveOptimizerBudgetTl(
    tripBudgetTl: number | null,
    affordableLevels: string[],
  ): number {
    if (tripBudgetTl !== null) {
      return tripBudgetTl;
    }

    const highestAffordableLevel =
      affordableLevels[affordableLevels.length - 1];
    if (highestAffordableLevel) {
      return (
        BUDGET_LEVEL_TO_TL[
          highestAffordableLevel.toLowerCase() as keyof typeof BUDGET_LEVEL_TO_TL
        ] ?? DEFAULT_OPTIMIZER_BUDGET_TL
      );
    }

    return DEFAULT_OPTIMIZER_BUDGET_TL;
  }

  private resolveMaxPois(
    explicitMaxPois: number | null,
    selectedCategories: string[],
    timeStart: string | null,
    timeEnd: string | null,
  ): number {
    if (explicitMaxPois !== null) {
      return explicitMaxPois;
    }

    const selectedCategoryCount = new Set(
      selectedCategories
        .map((category) => category.trim().toLowerCase())
        .filter(Boolean),
    ).size;
    const categoryDrivenMax =
      selectedCategoryCount > 0
        ? Math.min(MAX_DEFAULT_STOPS, Math.max(3, selectedCategoryCount + 1))
        : DEFAULT_MAX_STOPS;
    const timeDrivenMax = this.targetCandidateCountForTimeWindow(
      timeStart ?? DEFAULT_OPTIMIZER_TIME_START,
      timeEnd ?? DEFAULT_OPTIMIZER_TIME_END,
    );

    return Math.max(
      1,
      Math.min(MAX_DEFAULT_STOPS, Math.max(categoryDrivenMax, timeDrivenMax)),
    );
  }

  private targetCandidateCountForTimeWindow(
    timeStart: string | null,
    timeEnd: string | null,
  ): number {
    if (!timeStart || !timeEnd) {
      return 0;
    }
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const startMin = toMin(timeStart);
    let endMin = toMin(timeEnd);
    if (endMin <= startMin) {
      endMin += 24 * 60;
    }
    const windowMin = Math.max(0, endMin - startMin);
    return Math.ceil(windowMin / MINUTES_PER_POI_BUDGET);
  }

  private async selectCandidatesForDestination(
    pool: PointOfInterest[],
    destination: string | null,
    targetCount: number,
    destinationAnchorPool: PointOfInterest[] = pool,
  ): Promise<PointOfInterest[]> {
    const needle = this.normalizeSearchText(destination);

    if (needle) {
      const knownDestination = this.resolveKnownDestination(needle);
      if (knownDestination) {
        const aliasMatches = pool.filter((poi) =>
          this.poiMatchesKnownDestination(poi, knownDestination),
        );
        const fallbackDistricts = knownDestination.fallbackDistricts ?? [
          knownDestination.district,
        ];

        return this.expandCandidatesAroundPoint(
          pool,
          knownDestination.anchor,
          aliasMatches,
          targetCount,
          knownDestination.radiusTiersKm,
          knownDestination.fallbackRadiusTiersKm ??
            KNOWN_DESTINATION_FALLBACK_RADIUS_TIERS_KM,
          this.filterCandidatesByDistricts(pool, fallbackDistricts),
          true,
        );
      }

      const districtMatches = pool.filter((poi) =>
        this.poiMatchesDestinationDistrict(poi, needle),
      );

      if (districtMatches.length > 0 && districtMatches.length >= targetCount) {
        return districtMatches;
      }

      if (districtMatches.length > 0) {
        return this.expandCandidatesAroundAnchor(
          pool,
          districtMatches,
          targetCount,
          DISTRICT_RADIUS_EXPANSION_TIERS_KM,
          KNOWN_DESTINATION_FALLBACK_RADIUS_TIERS_KM,
          this.filterCandidatesByDistricts(
            pool,
            this.fallbackDistrictsForAnchorPois(districtMatches),
          ),
          true,
        );
      }

      const areaMatches = pool.filter((poi) =>
        this.poiMatchesDestinationArea(poi, needle),
      );

      // Destination can be a neighborhood/POI name ("Nişantaşı") or a free-form
      // area in the address. Keep those much tighter than whole-district plans.
      if (areaMatches.length > 0) {
        return this.expandCandidatesAroundAnchor(
          pool,
          areaMatches,
          targetCount,
          AREA_RADIUS_EXPANSION_TIERS_KM,
          KNOWN_DESTINATION_FALLBACK_RADIUS_TIERS_KM,
          this.filterCandidatesByDistricts(
            pool,
            this.fallbackDistrictsForAnchorPois(areaMatches),
          ),
          true,
        );
      }

      const anchorOnlyMatches = destinationAnchorPool.filter(
        (poi) =>
          this.poiMatchesDestinationDistrict(poi, needle) ||
          this.poiMatchesDestinationArea(poi, needle),
      );

      if (anchorOnlyMatches.length > 0) {
        return this.expandCandidatesAroundAnchor(
          pool,
          anchorOnlyMatches,
          targetCount,
          AREA_RADIUS_EXPANSION_TIERS_KM,
          KNOWN_DESTINATION_FALLBACK_RADIUS_TIERS_KM,
          this.filterCandidatesByDistricts(
            pool,
            this.fallbackDistrictsForAnchorPois(anchorOnlyMatches),
          ),
          true,
        );
      }
    }

    // Destination didn't match any district (typo, freeform input, empty).
    // Fall back to a geographic radius around the city centre.
    return pool.filter(
      (poi) =>
        haversineKm(ISTANBUL_CENTER, { lat: poi.lat, lng: poi.lng }) <=
        FALLBACK_RADIUS_KM,
    );
  }

  private expandCandidatesAroundAnchor(
    pool: PointOfInterest[],
    anchorPois: PointOfInterest[],
    targetCount: number,
    radiusTiersKm: number[],
    emptyResultRadiusTiersKm: number[] = [],
    emptyResultPool: PointOfInterest[] = pool,
    expandWhenSparse = false,
  ): PointOfInterest[] {
    return this.expandCandidatesAroundPoint(
      pool,
      this.centroidOf(anchorPois),
      anchorPois,
      targetCount,
      radiusTiersKm,
      emptyResultRadiusTiersKm,
      emptyResultPool,
      expandWhenSparse,
    );
  }

  private expandCandidatesAroundPoint(
    pool: PointOfInterest[],
    anchor: { lat: number; lng: number },
    anchorPois: PointOfInterest[],
    targetCount: number,
    radiusTiersKm: number[],
    emptyResultRadiusTiersKm: number[] = [],
    emptyResultPool: PointOfInterest[] = pool,
    expandWhenSparse = false,
  ): PointOfInterest[] {
    const poolIds = new Set(pool.map((poi) => poi.id));
    const eligibleAnchorPois = anchorPois.filter((poi) => poolIds.has(poi.id));
    const anchorIds = new Set(eligibleAnchorPois.map((poi) => poi.id));
    const neighbors = pool
      .filter((poi) => !anchorIds.has(poi.id))
      .map((poi) => ({
        poi,
        distanceKm: haversineKm(anchor, { lat: poi.lat, lng: poi.lng }),
      }))
      .sort(
        (left, right) =>
          left.distanceKm - right.distanceKm ||
          left.poi.name.localeCompare(right.poi.name),
      );

    for (const radiusKm of radiusTiersKm) {
      const merged = [
        ...eligibleAnchorPois,
        ...neighbors
          .filter((entry) => entry.distanceKm <= radiusKm)
          .map((entry) => entry.poi),
      ];
      if (merged.length >= targetCount) {
        return merged;
      }
    }

    const widest =
      radiusTiersKm[radiusTiersKm.length - 1] ?? FALLBACK_RADIUS_KM;
    const widestResult = [
      ...eligibleAnchorPois,
      ...neighbors
        .filter((entry) => entry.distanceKm <= widest)
        .map((entry) => entry.poi),
    ];

    if (
      widestResult.length >= targetCount ||
      emptyResultRadiusTiersKm.length === 0
    ) {
      return widestResult;
    }

    if (widestResult.length > 0 && !expandWhenSparse) {
      return widestResult;
    }

    const emptyResultPoolIds = new Set(emptyResultPool.map((poi) => poi.id));
    let expandedFallback: PointOfInterest[] = [];
    for (const radiusKm of emptyResultRadiusTiersKm) {
      const selectedIds = new Set<string>();
      expandedFallback = [];

      for (const poi of widestResult) {
        if (!selectedIds.has(poi.id)) {
          expandedFallback.push(poi);
          selectedIds.add(poi.id);
        }
      }

      for (const entry of neighbors) {
        if (
          emptyResultPoolIds.has(entry.poi.id) &&
          entry.distanceKm <= radiusKm &&
          !selectedIds.has(entry.poi.id)
        ) {
          expandedFallback.push(entry.poi);
          selectedIds.add(entry.poi.id);
        }
      }

      if (expandedFallback.length >= targetCount) {
        return expandedFallback;
      }
    }

    return expandedFallback;
  }

  private filterCandidatesByDistricts(
    pool: PointOfInterest[],
    districts: string[],
  ): PointOfInterest[] {
    const allowedDistricts = new Set(
      districts.map((district) => this.normalizeSearchText(district)),
    );

    return pool.filter((poi) =>
      allowedDistricts.has(this.normalizeSearchText(poi.district)),
    );
  }

  private fallbackDistrictsForAnchorPois(
    anchorPois: PointOfInterest[],
  ): string[] {
    const fallbackDistricts = new Set<string>();

    for (const poi of anchorPois) {
      for (const district of this.fallbackDistrictsForDistrict(poi.district)) {
        fallbackDistricts.add(district);
      }
    }

    return [...fallbackDistricts];
  }

  private fallbackDistrictsForDistrict(
    district: string | null | undefined,
  ): string[] {
    const normalizedDistrict = this.normalizeSearchText(district);
    if (!normalizedDistrict) {
      return [];
    }

    const configuredDistricts = Object.entries(DISTRICT_FALLBACK_GROUPS).find(
      ([key]) => this.normalizeSearchText(key) === normalizedDistrict,
    )?.[1];

    return configuredDistricts ?? [district as string];
  }

  private resolveDestinationAnchorFromPool(
    pool: PointOfInterest[],
    destination: string | null,
  ): { lat: number; lng: number } | null {
    const needle = this.normalizeSearchText(destination);
    if (!needle) {
      return null;
    }
    const knownDestination = this.resolveKnownDestination(needle);
    if (knownDestination) {
      return knownDestination.anchor;
    }

    const destinationMatches = pool.filter(
      (poi) =>
        this.poiMatchesDestinationDistrict(poi, needle) ||
        this.poiMatchesDestinationArea(poi, needle),
    );
    if (destinationMatches.length === 0) {
      return null;
    }
    return this.centroidOf(destinationMatches);
  }

  private resolveKnownDestination(
    normalizedNeedle: string,
  ): DestinationAlias | null {
    return (
      DESTINATION_ALIASES.find((destination) => {
        const terms = [destination.label, ...destination.aliases]
          .map((term) => this.normalizeSearchText(term))
          .filter(Boolean);

        return terms.some(
          (term) =>
            term === normalizedNeedle ||
            normalizedNeedle.includes(term) ||
            (normalizedNeedle.length >= 5 && term.includes(normalizedNeedle)),
        );
      }) ?? null
    );
  }

  private poiMatchesKnownDestination(
    poi: PointOfInterest,
    destination: DestinationAlias,
  ): boolean {
    const terms = [destination.label, ...destination.aliases]
      .map((term) => this.normalizeSearchText(term))
      .filter(Boolean);
    const fields = [poi.name, poi.address]
      .map((value) => this.normalizeSearchText(value))
      .filter(Boolean);

    return fields.some((field) =>
      terms.some(
        (term) =>
          field === term || field.includes(term) || term.includes(field),
      ),
    );
  }

  private poiMatchesDestinationDistrict(
    poi: PointOfInterest,
    normalizedNeedle: string,
  ): boolean {
    const district = this.normalizeSearchText(poi.district);
    return (
      Boolean(district) &&
      (district === normalizedNeedle || normalizedNeedle.includes(district))
    );
  }

  private poiMatchesDestinationArea(
    poi: PointOfInterest,
    normalizedNeedle: string,
  ): boolean {
    const fields = [poi.name, poi.address]
      .map((value) => this.normalizeSearchText(value))
      .filter(Boolean);

    return fields.some(
      (field) =>
        field === normalizedNeedle ||
        field.includes(normalizedNeedle) ||
        normalizedNeedle.includes(field),
    );
  }

  private normalizeSearchText(value: string | null | undefined): string {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[ıİ]/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private centroidOf(pois: { lat: number; lng: number }[]): {
    lat: number;
    lng: number;
  } {
    const sum = pois.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return { lat: sum.lat / pois.length, lng: sum.lng / pois.length };
  }

  private mapPoiToOptimizerCandidate(poi: PointOfInterest) {
    return {
      poi_id: poi.id,
      name: poi.name,
      location: {
        lat: poi.lat,
        lng: poi.lng,
      },
      category: poi.category.toLowerCase(),
      opening_hours: {
        open: poi.openingHoursOpen,
        close: poi.openingHoursClose,
      },
      budget: {
        min_tl: poi.estimatedMinCostTl ?? 0,
        max_tl: poi.estimatedMaxCostTl ?? poi.estimatedMinCostTl ?? 500,
      },
      visit_duration_minutes: poi.avgDurationMin,
    };
  }

  private normalizeWeather(
    weather: string | null,
  ): OptimizerOptimizeRequest['preferences']['weather'] {
    if (weather === 'clear' || weather === 'cloudy' || weather === 'rainy') {
      return weather;
    }

    return undefined;
  }

  private buildNoFeasibleRouteResult(
    request: OptimizerOptimizeRequest,
    algorithmUsed: string,
  ): OptimizerOptimizeResponse {
    return {
      trip_id: request.trip_id,
      date: request.date,
      route: {
        route_name: `No feasible route for ${request.date}`,
        total_distance_km: 0,
        total_cost_tl: 0,
        total_duration_minutes: 0,
        stops: [],
      },
      algorithm_used: algorithmUsed,
      generated_at: new Date().toISOString(),
    };
  }

  private buildRouteExplanation(
    trip: Awaited<ReturnType<TripsService['getOwnedTripOrThrow']>>,
    optimizerResult: OptimizerOptimizeResponse,
    candidatePois: PointOfInterest[],
  ): string {
    const selectedStops = optimizerResult.route.stops;

    if (selectedStops.length === 0) {
      return 'No feasible route could be produced from the current constraints. The current time window and trip preferences did not yield a workable set of stops.';
    }

    const sentences: string[] = [];
    const timeWindow = this.formatTimeWindow(
      trip.timeStart ?? selectedStops[0]?.arrival_time ?? null,
      trip.timeEnd ??
        selectedStops[selectedStops.length - 1]?.departure_time ??
        null,
    );

    if (trip.maxPois !== null && selectedStops.length >= trip.maxPois) {
      sentences.push(
        `This route includes ${selectedStops.length} stops, which reaches your current max stop limit${timeWindow ? ` within the ${timeWindow} day window` : ''}.`,
      );
    } else {
      sentences.push(
        `This route includes ${selectedStops.length} stops${timeWindow ? ` across the ${timeWindow} day window` : ''}.`,
      );
    }

    const categoryFocus = this.describeCategoryFocus(
      selectedStops,
      candidatePois,
    );
    if (categoryFocus) {
      sentences.push(
        `The selected stops lean toward ${categoryFocus} based on the places that fit your current preferences.`,
      );
    }

    sentences.push(
      `The current result covers about ${this.formatDecimal(optimizerResult.route.total_distance_km, 1)} km, ${optimizerResult.route.total_duration_minutes} minutes, and an estimated ${this.formatCurrency(optimizerResult.route.total_cost_tl)}.`,
    );

    return sentences.slice(0, 3).join(' ');
  }

  private describeCategoryFocus(
    selectedStops: OptimizerOptimizeResponse['route']['stops'],
    candidatePois: PointOfInterest[],
  ): string | null {
    const poiById = new Map(candidatePois.map((poi) => [poi.id, poi]));
    const categoryCounts = new Map<string, number>();

    for (const stop of selectedStops) {
      const poi = poiById.get(stop.poi_id);
      if (!poi) {
        continue;
      }

      const category = poi.category.toLowerCase();
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }

    const topCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 2)
      .map(([category]) => category);

    if (topCategories.length === 0) {
      return null;
    }

    return this.formatList(topCategories);
  }

  private formatTimeWindow(
    start: string | null,
    end: string | null,
  ): string | null {
    if (!start && !end) {
      return null;
    }

    if (start && end) {
      return `${start}–${end}`;
    }

    return start ?? end;
  }

  private formatList(values: string[]): string {
    if (values.length <= 1) {
      return values[0] ?? '';
    }

    if (values.length === 2) {
      return `${values[0]} and ${values[1]}`;
    }

    return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
  }

  private formatDecimal(value: number, digits: number): string {
    return value.toFixed(digits).replace(/\.0+$/, '');
  }

  private formatCurrency(value: number): string {
    return `₺${Math.round(value)}`;
  }

  private toTripListItem(trip: TripListRecord) {
    const preview = buildTripPreview({
      title: trip.title,
      routeName: trip.routeName,
      categories: trip.categories,
      routeTotalDurationMin: trip.routeTotalDurationMin,
      routeTotalCostTl: trip.routeTotalCostTl,
      coverImageUrl: trip.coverImageUrl,
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
      userId: trip.userId,
      title: trip.title,
      destination: trip.destination,
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
      routeName: trip.routeName,
      routeTotalDistanceKm: trip.routeTotalDistanceKm,
      routeTotalDurationMin: trip.routeTotalDurationMin,
      routeTotalCostTl: trip.routeTotalCostTl,
      routeAlgorithmUsed: trip.routeAlgorithmUsed,
      routeExplanation: trip.routeExplanation,
      optimizedAt: trip.optimizedAt,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      preview,
      _count: trip._count,
    };
  }

  private toExploreTripItem(trip: ExploreTripRecord) {
    const preview = buildTripPreview({
      title: trip.title,
      routeName: trip.routeName,
      categories: trip.categories,
      routeTotalDurationMin: trip.routeTotalDurationMin,
      routeTotalCostTl: trip.routeTotalCostTl,
      coverImageUrl: trip.coverImageUrl,
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
      creator: {
        id: trip.user?.id ?? null,
        displayName: trip.user?.displayName ?? null,
        avatarUrl: trip.user?.avatarUrl ?? null,
      },
    };
  }

  private toTripDetailResponse(trip: TripDetailRecord) {
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
      coverImageUrl: trip.coverImageUrl,
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

    return {
      trip: {
        id: trip.id,
        title: trip.title,
        destination: trip.destination,
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
        coverImageUrl: trip.coverImageUrl ?? null,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
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
      preview,
      stops,
    };
  }
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
