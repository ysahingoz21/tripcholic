import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
