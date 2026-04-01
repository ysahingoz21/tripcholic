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
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// ── Path helpers ──────────────────────────────────────────────────────────────

// process.cwd() is apps/backend/ when run via npm script — go up two levels
// to reach the monorepo root where data/ lives.
const MONOREPO_ROOT = resolve(process.cwd(), '../..');

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
        headers = trimmed.split(',').map((h) => h.trim());
        firstLine = false;
        return;
      }

      const values = trimmed.split(',');
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

function parseOpeningHours(raw: string): { open: string; close: string } {
  const dash = raw.indexOf('-');
  if (dash === -1) throw new Error(`Cannot parse opening_hours: "${raw}"`);
  return {
    open:  raw.slice(0, dash).trim(),
    close: raw.slice(dash + 1).trim(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const csvPath = resolve(MONOREPO_ROOT, 'data/istanbul_poi_dataset.csv');
  console.log(`[seed] Reading: ${csvPath}`);

  const rows = await readCsv(csvPath);
  console.log(`[seed] ${rows.length} rows found`);

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row['name'];
    if (!name) {
      skipped++;
      continue;
    }

    try {
      const hours = parseOpeningHours(row['opening_hours']);
      const id    = poiUuid(name);

      const data = {
        name,
        category:          parseCategory(row['category']) as never,
        lat:               parseFloat(row['lat']),
        lng:               parseFloat(row['lng']),
        avgDurationMin:    parseInt(row['avg_duration_min'], 10),
        budgetLevel:       parseBudget(row['budget']) as never,
        openingHoursOpen:  hours.open,
        openingHoursClose: hours.close,
      };

      await prisma.pointOfInterest.upsert({
        where:  { id },
        create: { id, ...data },
        update: data,
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
