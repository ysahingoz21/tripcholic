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
  historical:    ['historical'],
  scenic:        ['scenic'],
  food:          ['food'],
  shopping:      ['shopping'],
  nature:        ['nature'],
  neighborhood:  ['neighborhood'],
  entertainment: ['entertainment'],
  culture:       ['historical', 'entertainment', 'neighborhood'],
  history:       ['historical'],
  museums:       ['entertainment', 'historical'],
  coffee:        ['food', 'neighborhood'],
  nightlife:     ['entertainment', 'food'],
};

const BUDGET_LEVEL_TO_TL: Record<string, number> = {
  low: 2000,
  medium: 6000,
  high: 20000,
};

const DEFAULT_OPTIMIZER_TIME_START = '09:00';
const DEFAULT_OPTIMIZER_TIME_END = '21:00';
const DEFAULT_OPTIMIZER_WALKING_TOLERANCE_KM = 3.0;
const DEFAULT_OPTIMIZER_MAX_POIS = 6;
const DEFAULT_OPTIMIZER_BUDGET_TL = 6000;
const MAX_CANDIDATE_POIS = 20;

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
        title:             payload.title,
        description:       payload.description ?? null,
        date:              new Date(payload.date),
        timeStart:         payload.startTime ?? null,
        timeEnd:           payload.endTime ?? null,
        budgetTl:          payload.budgetTl ?? null,
        categories:        payload.categories ?? [],
        weather:           payload.weather ?? null,
        walkingToleranceKm: payload.maxWalkingDistanceKm ?? null,
        maxPois:           payload.maxStops ?? null,
        visibility:        payload.visibility ?? 'DRAFT',
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

    return trips.map((trip) => this.toTripListItem(trip as TripListRecord));
  }

  async findExploreTrips(query: ExploreTripsQueryDto) {
    const client = await this.prisma.getClient();
    const trimmedQuery = query.q?.trim();
    const normalizedQuery = trimmedQuery ? trimmedQuery : null;
    const normalizedCategory = query.category?.trim().toLowerCase() ?? null;
    const normalizedWeather = query.weather?.trim().toLowerCase() ?? null;
    const limit = query.limit ?? 20;

    const where: Prisma.TripWhereInput = {
      visibility: 'PUBLIC',
      status: 'OPTIMIZED',
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
      ...((query.budgetMinTl !== undefined || query.budgetMaxTl !== undefined) && {
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

    const availableCategories = [...new Set(
      categoryRows
        .flatMap((trip) => trip.categories)
        .map((category) => category.trim().toLowerCase())
        .filter(Boolean),
    )].sort((left, right) => left.localeCompare(right));

    return {
      items: trips.map((trip) => this.toExploreTripItem(trip as ExploreTripRecord)),
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
        ...(payload.title !== undefined           && { title: payload.title }),
        ...(payload.description !== undefined     && { description: payload.description }),
        ...(payload.date !== undefined            && { date: new Date(payload.date) }),
        ...(payload.startTime !== undefined       && { timeStart: payload.startTime }),
        ...(payload.endTime !== undefined         && { timeEnd: payload.endTime }),
        ...(payload.budgetTl !== undefined        && { budgetTl: payload.budgetTl }),
        ...(payload.categories !== undefined      && { categories: payload.categories }),
        ...(payload.weather !== undefined         && { weather: payload.weather }),
        ...(payload.maxWalkingDistanceKm !== undefined && { walkingToleranceKm: payload.maxWalkingDistanceKm }),
        ...(payload.maxStops !== undefined        && { maxPois: payload.maxStops }),
        ...(payload.visibility !== undefined      && { visibility: payload.visibility }),
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
      ...(dbCategories.length > 0 && { category: { in: dbCategories as never[] } }),
      budgetLevel: { in: affordableLevels as never[] },
    };

    const pois = await client.pointOfInterest.findMany({
      where: poiWhere,
      orderBy: [{ category: 'asc' }, { avgDurationMin: 'asc' }, { name: 'asc' }],
      take: MAX_CANDIDATE_POIS,
    });

    const candidatePois = pois.map((poi) => this.mapPoiToOptimizerCandidate(poi));
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
        max_pois: trip.maxPois ?? DEFAULT_OPTIMIZER_MAX_POIS,
        weather: this.normalizeWeather(trip.weather),
      },
      candidate_pois: candidatePois,
    };

    const optimizerResult =
      candidatePois.length > 0
        ? await this.optimizerService.callOptimize(optimizerRequest)
        : this.buildNoFeasibleRouteResult(optimizerRequest, 'backend_no_candidates');
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
          status: optimizerResult.route.stops.length > 0 ? 'OPTIMIZED' : 'FAILED',
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

  private resolveOptimizerBudgetTl(
    tripBudgetTl: number | null,
    affordableLevels: string[],
  ): number {
    if (tripBudgetTl !== null) {
      return tripBudgetTl;
    }

    const highestAffordableLevel = affordableLevels[affordableLevels.length - 1];
    if (highestAffordableLevel) {
      return (
        BUDGET_LEVEL_TO_TL[
          highestAffordableLevel.toLowerCase() as keyof typeof BUDGET_LEVEL_TO_TL
        ] ?? DEFAULT_OPTIMIZER_BUDGET_TL
      );
    }

    return DEFAULT_OPTIMIZER_BUDGET_TL;
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

    const categoryFocus = this.describeCategoryFocus(selectedStops, candidatePois);
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
        displayName: trip.user?.displayName ?? null,
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
