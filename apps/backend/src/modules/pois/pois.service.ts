import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ListPoisQueryDto } from './dto/list-pois-query.dto';

type PoiRecord = {
  id: string;
  title: string;
  category: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  suggestedVisitDurationMinutes: number;
  pricing: {
    budgetLevel: string;
  };
  openingHours: {
    open: string;
    close: string;
  };
};

@Injectable()
export class PoisService {
  private cachedPois: PoiRecord[] | null = null;

  async findAll(query: ListPoisQueryDto) {
    const pois = await this.loadPois();
    const filtered = pois.filter((poi) => {
      if (query.category && poi.category !== query.category) {
        return false;
      }

      if (query.search) {
        const needle = query.search.toLowerCase();
        return poi.title.toLowerCase().includes(needle);
      }

      return true;
    });

    const limit = query.limit ?? 20;

    return {
      items: filtered.slice(0, limit),
      meta: {
        total: filtered.length,
        limit,
        source: 'istanbul_poi_dataset.csv',
      },
    };
  }

  async findOne(id: string) {
    const pois = await this.loadPois();
    const poi = pois.find((item) => item.id === id);

    if (!poi) {
      throw new NotFoundException(`POI not found for id "${id}"`);
    }

    return poi;
  }

  private async loadPois(): Promise<PoiRecord[]> {
    if (this.cachedPois) {
      return this.cachedPois;
    }

    const datasetPath = path.resolve(
      process.cwd(),
      '../../data/istanbul_poi_dataset.csv',
    );
    const csv = await readFile(datasetPath, 'utf-8');
    const lines = csv.split(/\r?\n/).filter(Boolean);

    const rows = lines.slice(1).map((line) => {
      const [
        name,
        category,
        lat,
        lng,
        avgDurationMin,
        budget,
        openingHours,
      ] = line.split(',');
      const [open, close] = openingHours.split('-');

      return {
        id: this.toId(name),
        title: name,
        category,
        coordinates: {
          lat: Number(lat),
          lng: Number(lng),
        },
        suggestedVisitDurationMinutes: Number(avgDurationMin),
        pricing: {
          budgetLevel: budget,
        },
        openingHours: {
          open,
          close,
        },
      };
    });

    this.cachedPois = rows;
    return rows;
  }

  private toId(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
  }
}
