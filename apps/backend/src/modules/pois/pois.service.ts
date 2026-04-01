import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListPoisQueryDto } from './dto/list-pois-query.dto';

@Injectable()
export class PoisService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListPoisQueryDto) {
    const client = await this.prisma.getClient();
    const limit = query.limit ?? 20;

    // DTO category values are lowercase (e.g. "historical").
    // DB enum values are uppercase (e.g. "HISTORICAL").
    const where = query.category
      ? { category: query.category.toUpperCase() as never }
      : undefined;

    const [items, total] = await Promise.all([
      client.pointOfInterest.findMany({
        where,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      client.pointOfInterest.count({ where }),
    ]);

    return {
      items,
      meta: { total, limit },
    };
  }

  async findOne(id: string) {
    const client = await this.prisma.getClient();

    const poi = await client.pointOfInterest.findUnique({ where: { id } });

    if (!poi) {
      throw new NotFoundException(`POI not found: "${id}"`);
    }

    return poi;
  }
}
