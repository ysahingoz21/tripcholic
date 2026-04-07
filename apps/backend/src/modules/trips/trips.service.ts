import { Injectable, NotFoundException } from '@nestjs/common';
import { OptimizerService } from '../optimizer/optimizer.service';
import { OptimizerOptimizeResponse } from '../optimizer/optimizer.types';
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

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly optimizerService: OptimizerService,
  ) {}

  async create(payload: CreateTripDto) {
    const client = await this.prisma.getClient();

    const trip = await client.trip.create({
      data: {
        // userId is intentionally null until JWT auth is wired.
        // Once auth is in place, extract userId from the request token here.
        title:             payload.title,
        description:       payload.description ?? null,
        date:              new Date(payload.date),
        timeStart:         payload.startTime ?? null,
        timeEnd:           payload.endTime ?? null,
        budgetTl:          payload.budgetTl ?? null,
        categories:        payload.interests ?? [],
        weather:           payload.weather ?? null,
        walkingToleranceKm: payload.maxWalkingDistanceKm ?? null,
        maxPois:           payload.maxStops ?? null,
      },
    });

    return trip;
  }

  async findAll() {
    const client = await this.prisma.getClient();

    const trips = await client.trip.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { stops: true } } },
    });

    return trips;
  }

  async findOne(id: string) {
    const client = await this.prisma.getClient();

    const trip = await client.trip.findUnique({
      where: { id },
      include: {
        stops: {
          orderBy: { order: 'asc' },
          include: { poi: true },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException(`Trip not found: "${id}"`);
    }

    return trip;
  }

  async update(id: string, payload: UpdateTripDto) {
    const client = await this.prisma.getClient();

    const existing = await client.trip.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Trip not found: "${id}"`);
    }

    const trip = await client.trip.update({
      where: { id },
      data: {
        ...(payload.title !== undefined           && { title: payload.title }),
        ...(payload.description !== undefined     && { description: payload.description }),
        ...(payload.date !== undefined            && { date: new Date(payload.date) }),
        ...(payload.startTime !== undefined       && { timeStart: payload.startTime }),
        ...(payload.endTime !== undefined         && { timeEnd: payload.endTime }),
        ...(payload.budgetTl !== undefined        && { budgetTl: payload.budgetTl }),
        ...(payload.interests !== undefined       && { categories: payload.interests }),
        ...(payload.weather !== undefined         && { weather: payload.weather }),
        ...(payload.maxWalkingDistanceKm !== undefined && { walkingToleranceKm: payload.maxWalkingDistanceKm }),
        ...(payload.maxStops !== undefined        && { maxPois: payload.maxStops }),
      },
    });

    return trip;
  }

  async remove(id: string) {
    const client = await this.prisma.getClient();

    const existing = await client.trip.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Trip not found: "${id}"`);
    }

    await client.trip.delete({ where: { id } });

    return { deleted: true, id };
  }

  private affordableBudgetLevels(budgetTl: number): never[] {
    // Always include LOW. Add MEDIUM if budget >= 2000, HIGH if >= 6000.
    const levels: string[] = ['LOW'];
    if (budgetTl >= 2000) levels.push('MEDIUM');
    if (budgetTl >= 6000) levels.push('HIGH');
    return levels as never[];
  }

  async optimize(id: string) {
    const client = await this.prisma.getClient();

    // 1. Load the trip
    const trip = await client.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException(`Trip not found: "${id}"`);

    // 2. Resolve which optimizer categories to query
    const optimizerCategories = [
      ...new Set(
        (trip.categories as string[]).flatMap(
          (c) => CATEGORY_MAP[c] ?? [c],
        ),
      ),
    ];

    const dbCategories = optimizerCategories.map(
      (c) => c.toUpperCase() as never,
    );

    // 3. Select candidate POIs from DB filtered by category + affordable budget level
    //    This keeps the candidate set small so CP-SAT solves fast.
    const affordableLevels = trip.budgetTl
      ? this.affordableBudgetLevels(trip.budgetTl)
      : (['LOW', 'MEDIUM', 'HIGH'] as never[]);

    const pois = await client.pointOfInterest.findMany({
      where: {
        category: { in: dbCategories },
        budgetLevel: { in: affordableLevels },
      },
      take: 50,
    });

    if (pois.length === 0) {
      throw new NotFoundException(
        'No POIs found for the requested categories.',
      );
    }

    // 4. Resolve budget — use trip value or fall back to budget level of POIs
    const budgetTl =
      trip.budgetTl ??
      BUDGET_LEVEL_TO_TL[
        pois[0].budgetLevel.toLowerCase() as keyof typeof BUDGET_LEVEL_TO_TL
      ] ??
      6000;

    // 5. Build optimizer request
    const optimizerRequest = {
      trip_id: trip.id,
      date: trip.date.toISOString().split('T')[0],
      preferences: {
        categories: optimizerCategories,
        time_start: trip.timeStart ?? '09:00',
        time_end: trip.timeEnd ?? '21:00',
        budget_tl: budgetTl,
        walking_tolerance_km: trip.walkingToleranceKm ?? 3.0,
        max_pois: trip.maxPois ?? 6,
        weather: (trip.weather as 'clear' | 'cloudy' | 'rainy') ?? undefined,
      },
      candidate_pois: pois.map((poi) => ({
        poi_id: poi.id,
        name: poi.name,
        location: { lat: poi.lat, lng: poi.lng },
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
      })),
    };

    // 6. Call optimizer
    const result = await this.optimizerService.callOptimize(optimizerRequest);

    // 7. Persist result — delete old stops, write new ones, update trip metadata
    await client.$transaction(async (tx) => {
      await tx.tripStop.deleteMany({ where: { tripId: id } });

      await tx.tripStop.createMany({
        data: result.route.stops.map((stop: OptimizerOptimizeResponse['route']['stops'][number], index: number) => ({
          tripId: id,
          poiId: stop.poi_id,
          order: index + 1,
          title: stop.name,
          arrivalTime: stop.arrival_time,
          departureTime: stop.departure_time,
          travelTimeToNextMin: stop.travel_time_to_next_minutes ?? null,
          estimatedCostTl: stop.estimated_cost_tl,
        })),
      });

      await tx.trip.update({
        where: { id },
        data: {
          status: 'OPTIMIZED',
          routeName: result.route.route_name,
          routeTotalDistanceKm: result.route.total_distance_km,
          routeTotalDurationMin: result.route.total_duration_minutes,
          routeTotalCostTl: result.route.total_cost_tl,
          routeAlgorithmUsed: result.algorithm_used,
          optimizedAt: new Date(),
        },
      });
    });

    // 8. Return the full trip with stops
    return this.findOne(id);
  }
}
