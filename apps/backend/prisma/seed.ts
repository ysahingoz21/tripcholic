/**
 * Prisma seed script — imports Istanbul POI dataset into PointOfInterest table.
 *
 * Usage (from apps/backend/):
 *   npm run prisma:seed
 *
 * Safe to run multiple times — uses upsert keyed on a stable UUID5 derived from
 * the POI name, matching the algorithm used by apps/optimizer/poi_loader.py.
 */

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DATASET_FILE_NAME = 'istanbul_poi_full_final_no_images.csv';

const DATASET_PATH_CANDIDATES = [
  resolve(process.cwd(), `../../data/${DATASET_FILE_NAME}`),
  resolve(process.cwd(), `../data/${DATASET_FILE_NAME}`),
  resolve(process.cwd(), `data/${DATASET_FILE_NAME}`),
];

// ── UUID5 ─────────────────────────────────────────────────────────────────────
// Matches Python: uuid.uuid5(uuid.NAMESPACE_DNS, f"tripcholic.poi.{name}")
// NAMESPACE_DNS = 6ba7b810-9dad-11d1-80b4-00c04fd430c8

const DNS_NAMESPACE = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');

function poiUuid(name: string): string {
  const hash = createHash('sha1')
    .update(DNS_NAMESPACE)
    .update(Buffer.from(`tripcholic.poi.${name}`, 'utf-8'))
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant 10xx

  const h = hash.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

async function readCsv(filePath: string): Promise<Record<string, string>[]> {
  return new Promise((res, rej) => {
    const rl = createInterface({
      input: createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity,
    });

    const rows: Record<string, string>[] = [];
    let headers: string[] = [];
    let firstLine = true;

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (firstLine) {
        headers = parseCsvLine(trimmed).map((h) => h.trim());
        firstLine = false;
        return;
      }

      const values = parseCsvLine(trimmed);
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = (values[i] ?? '').trim();
      });
      rows.push(row);
    });

    rl.on('close', () => res(rows));
    rl.on('error', rej);
  });
}

async function resolveDatasetPath(): Promise<string> {
  for (const candidate of DATASET_PATH_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `Dataset file not found. Tried: ${DATASET_PATH_CANDIDATES.join(', ')}`,
  );
}

// ── Field mappers ─────────────────────────────────────────────────────────────

// Prisma enum values are strings at runtime — using string literals avoids
// importing the enum types which may not exist until after prisma generate.
const CATEGORY_MAP: Record<string, string> = {
  historical:    'HISTORICAL',
  scenic:        'SCENIC',
  food:          'FOOD',
  shopping:      'SHOPPING',
  nature:        'NATURE',
  neighborhood:  'NEIGHBORHOOD',
  entertainment: 'ENTERTAINMENT',
};

const BUDGET_MAP: Record<string, string> = {
  low:    'LOW',
  medium: 'MEDIUM',
  high:   'HIGH',
};

const BUDGET_RANGE_MAP: Record<
  string,
  { min: number; max: number }
> = {
  low: { min: 0, max: 2000 },
  medium: { min: 2000, max: 6000 },
  high: { min: 6000, max: 20000 },
};

type CsvPoiRow = {
  name: string;
  category: string;
  district?: string;
  address?: string;
  lat: string;
  lng: string;
  avg_duration_min: string;
  budget: string;
  opening_hours?: string;
  available_hours?: string;
  image_url?: string;
};

function parseCategory(raw: string): string {
  const mapped = CATEGORY_MAP[raw.toLowerCase()];
  if (!mapped) throw new Error(`Unknown category: "${raw}"`);
  return mapped;
}

function parseBudget(raw: string): string {
  const mapped = BUDGET_MAP[raw.toLowerCase()];
  if (!mapped) throw new Error(`Unknown budget level: "${raw}"`);
  return mapped;
}

function parseBudgetRange(raw: string): { estimatedMinCostTl: number; estimatedMaxCostTl: number } {
  const mapped = BUDGET_RANGE_MAP[raw.toLowerCase()];
  if (!mapped) throw new Error(`Unknown budget range: "${raw}"`);

  return {
    estimatedMinCostTl: mapped.min,
    estimatedMaxCostTl: mapped.max,
  };
}

function parseOpeningHours(raw: string): { open: string; close: string } {
  const dash = raw.indexOf('-');
  if (dash === -1) throw new Error(`Cannot parse opening_hours: "${raw}"`);
  return {
    open:  raw.slice(0, dash).trim(),
    close: raw.slice(dash + 1).trim(),
  };
}

function parseFloatField(raw: string, fieldName: string): number {
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid float for ${fieldName}: "${raw}"`);
  }
  return value;
}

function parseIntField(raw: string, fieldName: string): number {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid integer for ${fieldName}: "${raw}"`);
  }
  return value;
}

function mapCsvRowToPoi(row: CsvPoiRow) {
  const hoursRaw = row.available_hours ?? row.opening_hours ?? '';
  const hours = parseOpeningHours(hoursRaw);
  const costs = parseBudgetRange(row.budget);

  return {
    id: poiUuid(row.name),
    name: row.name,
    category: parseCategory(row.category) as never,
    description: null,
    district: row.district || null,
    address: row.address || null,
    imageUrl: row.image_url || null,
    source: DATASET_FILE_NAME,
    lat: parseFloatField(row.lat, 'lat'),
    lng: parseFloatField(row.lng, 'lng'),
    avgDurationMin: parseIntField(row.avg_duration_min, 'avg_duration_min'),
    budgetLevel: parseBudget(row.budget) as never,
    estimatedMinCostTl: costs.estimatedMinCostTl,
    estimatedMaxCostTl: costs.estimatedMaxCostTl,
    openingHoursOpen: hours.open,
    openingHoursClose: hours.close,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the seed script');
  }

  const datasetPath = await resolveDatasetPath();
  console.log(`[seed] Reading: ${datasetPath}`);

  const rows = (await readCsv(datasetPath)) as CsvPoiRow[];
  console.log(`[seed] ${rows.length} rows found`);

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row.name;
    if (!name) {
      skipped++;
      continue;
    }

    try {
      const mapped = mapCsvRowToPoi(row);

      await prisma.pointOfInterest.upsert({
        where: { id: mapped.id },
        create: mapped as never,
        update: {
          name: mapped.name,
          category: mapped.category,
          description: mapped.description,
          district: mapped.district,
          address: mapped.address,
          imageUrl: mapped.imageUrl,
          source: mapped.source,
          lat: mapped.lat,
          lng: mapped.lng,
          avgDurationMin: mapped.avgDurationMin,
          budgetLevel: mapped.budgetLevel,
          estimatedMinCostTl: mapped.estimatedMinCostTl,
          estimatedMaxCostTl: mapped.estimatedMaxCostTl,
          openingHoursOpen: mapped.openingHoursOpen,
          openingHoursClose: mapped.openingHoursClose,
        } as never,
      });

      upserted++;
    } catch (err) {
      console.warn(`[seed] Skipping "${name}": ${err instanceof Error ? err.message : err}`);
      skipped++;
    }
  }

  console.log(`[seed] Done — ${upserted} upserted, ${skipped} skipped`);
}

main()
  .catch((err) => {
    console.error('[seed] Fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
