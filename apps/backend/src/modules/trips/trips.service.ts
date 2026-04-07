import { Injectable, NotFoundException } from '@nestjs/common';
import { PointOfInterest, Prisma } from '@prisma/client';
import { OptimizerService } from '../optimizer/optimizer.service';
import {
  OptimizerOptimizeRequest,
  OptimizerOptimizeResponse,
} from '../optimizer/optimizer.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
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
const MAX_CANDIDATE_POIS = 50;

type TripDetailRecord = Prisma.TripGetPayload<{
  include: {
    stops: {
      include: {
        poi: true;
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
      },
    });

    return this.findOne(userId, trip.id);
  }

  async findAll(userId: string) {
    const client = await this.prisma.getClient();

    const trips = await client.trip.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { stops: true } } },
    });

    return trips;
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

    const trip = await client.trip.update({
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
      },
    });

    return trip;
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
        stopCount: stops.length,
        isOptimized: trip.status === 'OPTIMIZED',
      },
      stops,
    };
  }
}
