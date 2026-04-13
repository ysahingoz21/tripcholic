import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListPoisQueryDto } from './dto/list-pois-query.dto';

type PoiApiResponse = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  district: string | null;
  address: string | null;
  imageUrl: string | null;
  source: string | null;
  coordinates: {
    lat: number;
    lng: number;
  };
  suggestedVisitDurationMinutes: number;
  pricing: {
    budgetLevel: string;
    minTl: number | null;
    maxTl: number | null;
  };
  openingHours: {
    open: string;
    close: string;
  };
};

type PoiRecord = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  avgDurationMin: number;
  budgetLevel: string;
  openingHoursOpen: string;
  openingHoursClose: string;
} & Partial<{
  description: string | null;
  district: string | null;
  address: string | null;
  imageUrl: string | null;
  source: string | null;
  estimatedMinCostTl: number | null;
  estimatedMaxCostTl: number | null;
}>;

@Injectable()
export class PoisService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListPoisQueryDto) {
    const client = await this.prisma.getClient();
    const limit = query.limit ?? 20;
    const where = {
      ...(query.category && {
        category: query.category.toUpperCase() as never,
      }),
      ...(query.search && {
        name: {
          contains: query.search,
          mode: 'insensitive' as const,
        },
      }),
    };

    const [items, total] = await Promise.all([
      client.pointOfInterest.findMany({
        where,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      client.pointOfInterest.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toApiResponse(item)),
      meta: {
        total,
        limit,
        filters: {
          category: query.category ?? null,
          search: query.search ?? null,
        },
      },
    };
  }

  async findOne(id: string) {
    const client = await this.prisma.getClient();

    const poi = await client.pointOfInterest.findUnique({ where: { id } });

    if (!poi) {
      throw new NotFoundException(`POI not found: "${id}"`);
    }

    return this.toApiResponse(poi);
  }

  private toApiResponse(item: PoiRecord): PoiApiResponse {
    return {
      id: item.id,
      title: item.name,
      category: item.category.toLowerCase(),
      description: item.description ?? null,
      district: item.district ?? null,
      address: item.address ?? null,
      imageUrl: item.imageUrl ?? null,
      source: item.source ?? null,
      coordinates: {
        lat: item.lat,
        lng: item.lng,
      },
      suggestedVisitDurationMinutes: item.avgDurationMin,
      pricing: {
        budgetLevel: item.budgetLevel.toLowerCase(),
        minTl: item.estimatedMinCostTl ?? null,
        maxTl: item.estimatedMaxCostTl ?? null,
      },
      openingHours: {
        open: item.openingHoursOpen,
        close: item.openingHoursClose,
      },
    };
  }
}
