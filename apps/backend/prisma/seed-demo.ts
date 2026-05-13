/**
 * Demo seed script — creates 5 sample users with 2 trips each for
 * testing/demo purposes. Requires POIs to already be seeded first.
 *
 * Usage (from apps/backend/):
 *   npm run seed:demo
 *
 * Safe to re-run — upserts users by email, then wipes and recreates
 * all trips/social data for those users on each run.
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function pick<T>(pool: T[], n: number): T[] {
  if (pool.length === 0) return [];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

type PoiRow = {
  id: string;
  name: string;
  avgDurationMin: number;
  estimatedMinCostTl: number | null;
  estimatedMaxCostTl: number | null;
  budgetLevel: string;
};

type StopData = {
  id: string;
  tripId: string;
  poiId: string;
  order: number;
  title: string;
  arrivalTime: string;
  departureTime: string;
  travelTimeToNextMin: number | null;
  estimatedCostTl: number;
};

function poiAvgCost(poi: PoiRow): number {
  if (poi.estimatedMinCostTl != null && poi.estimatedMaxCostTl != null) {
    return (poi.estimatedMinCostTl + poi.estimatedMaxCostTl) / 2;
  }
  return poi.budgetLevel === 'LOW' ? 50 : poi.budgetLevel === 'MEDIUM' ? 300 : 1000;
}

function buildStops(tripId: string, pois: PoiRow[], startTime: string, travelMin = 15): StopData[] {
  let cursor = startTime;
  return pois.map((poi, i) => {
    const arrival   = cursor;
    const departure = addMinutes(arrival, poi.avgDurationMin);
    cursor = addMinutes(departure, travelMin);
    return {
      id: randomUUID(),
      tripId,
      poiId: poi.id,
      order: i + 1,
      title: poi.name,
      arrivalTime: arrival,
      departureTime: departure,
      travelTimeToNextMin: i < pois.length - 1 ? travelMin : null,
      estimatedCostTl: poiAvgCost(poi),
    };
  });
}

// ── Demo user definitions ─────────────────────────────────────────────────────

const DEMO_USERS = [
  { email: 'yusuf@test.com', password: 'yusuf123', displayName: 'Yusuf Şahingöz' },
  { email: 'hasan@test.com', password: 'hasan123', displayName: 'Hasan Öztekin'  },
  { email: 'aziz@test.com',  password: 'aziz123',  displayName: 'Aziz Yıldırım'  },
  { email: 'aykut@test.com', password: 'aykut123', displayName: 'Aykut Kocaman'  },
  { email: 'eda@test.com',   password: 'eda123',   displayName: 'Eda Erdem'       },
] as const;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  console.log('[demo-seed] Starting...\n');

  // ── 1. Upsert users ──────────────────────────────────────────────────────

  const uid: Record<string, string> = {};

  for (const u of DEMO_USERS) {
    const passwordHash = await hash(u.password, BCRYPT_ROUNDS);
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { displayName: u.displayName },
      create: { email: u.email, passwordHash, displayName: u.displayName },
    });
    uid[u.email] = user.id;
    console.log(`  [user] ${u.displayName} (${u.email})`);
  }

  const [yusuf, hasan, aziz, aykut, eda] = [
    uid['yusuf@test.com'],
    uid['hasan@test.com'],
    uid['aziz@test.com'],
    uid['aykut@test.com'],
    uid['eda@test.com'],
  ];

  // ── 2. Fetch POI pools by category ────────────────────────────────────────

  console.log('\n[demo-seed] Loading POI pools...');

  const [historical, scenic, food, shopping, nature, entertainment, neighborhood] =
    await Promise.all([
      prisma.pointOfInterest.findMany({ where: { category: 'HISTORICAL'    }, take: 8, orderBy: { avgDurationMin: 'desc' } }),
      prisma.pointOfInterest.findMany({ where: { category: 'SCENIC'        }, take: 6, orderBy: { avgDurationMin: 'desc' } }),
      prisma.pointOfInterest.findMany({ where: { category: 'FOOD'          }, take: 6, orderBy: { avgDurationMin: 'asc'  } }),
      prisma.pointOfInterest.findMany({ where: { category: 'SHOPPING'      }, take: 6, orderBy: { avgDurationMin: 'desc' } }),
      prisma.pointOfInterest.findMany({ where: { category: 'NATURE'        }, take: 5, orderBy: { avgDurationMin: 'desc' } }),
      prisma.pointOfInterest.findMany({ where: { category: 'ENTERTAINMENT' }, take: 5, orderBy: { avgDurationMin: 'desc' } }),
      prisma.pointOfInterest.findMany({ where: { category: 'NEIGHBORHOOD'  }, take: 5, orderBy: { avgDurationMin: 'desc' } }),
    ]);

  console.log(
    `  historical=${historical.length} scenic=${scenic.length} food=${food.length} ` +
    `shopping=${shopping.length} nature=${nature.length} entertainment=${entertainment.length} ` +
    `neighborhood=${neighborhood.length}`,
  );

  // ── 3. Wipe existing demo trips ───────────────────────────────────────────

  console.log('\n[demo-seed] Clearing previous demo data...');
  const demoUserIds = Object.values(uid);
  await prisma.tripStop.deleteMany(       { where: { trip: { userId: { in: demoUserIds } } } });
  await prisma.tripLike.deleteMany(       { where: { trip: { userId: { in: demoUserIds } } } });
  await prisma.tripComment.deleteMany(    { where: { trip: { userId: { in: demoUserIds } } } });
  await prisma.savedTrip.deleteMany(      { where: { trip: { userId: { in: demoUserIds } } } });
  await prisma.tripCompletion.deleteMany( { where: { trip: { userId: { in: demoUserIds } } } });
  await prisma.trip.deleteMany(           { where: { userId: { in: demoUserIds } } });
  await prisma.userFollow.deleteMany(     { where: { followerId: { in: demoUserIds } } });

  // ── 4. Create trips with stops ────────────────────────────────────────────

  console.log('\n[demo-seed] Creating trips...');

  type TripSpec = {
    userId: string;
    title: string;
    description: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    categories: string[];
    budgetTl: number;
    visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT';
    weather: string;
    walkingToleranceKm: number;
    maxPois: number;
    status: 'OPTIMIZED' | 'PENDING';
    routeName?: string;
    routeTotalDistanceKm?: number;
    routeTotalDurationMin?: number;
    routeAlgorithmUsed?: string;
    routeExplanation?: string;
    optimizedAt?: Date;
    poiPool: PoiRow[];
    stopCount: number;
  };

  const tripSpecs: TripSpec[] = [

    // ── Yusuf Şahingöz ─────────────────────────────────────────────────────
    {
      userId: yusuf,
      title: 'Sultanahmet Tarihi Keşfi',
      description: 'Sultanahmet meydanı ve çevresindeki tarihi yapıların gün içinde adım adım keşfi.',
      date: '2026-05-15', timeStart: '09:00', timeEnd: '18:00',
      categories: ['historical'], budgetTl: 500,
      visibility: 'PUBLIC', weather: 'clear',
      walkingToleranceKm: 5, maxPois: 5, status: 'OPTIMIZED',
      routeName: 'Sultanahmet Tarihi Rota',
      routeTotalDistanceKm: 4.2, routeTotalDurationMin: 480,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: 'Sultanahmet bölgesindeki tarihi yapıları kapsayan yaya odaklı rota.',
      optimizedAt: new Date('2026-05-14T10:00:00Z'),
      poiPool: historical, stopCount: 4,
    },
    {
      userId: yusuf,
      title: "Boğaz'da Akşam Keyfi",
      description: 'Boğaz kıyısında manzaralı mekanlar, balık restoranları ve gün batımı seyri.',
      date: '2026-05-20', timeStart: '17:00', timeEnd: '22:00',
      categories: ['scenic', 'food'], budgetTl: 800,
      visibility: 'PRIVATE', weather: 'clear',
      walkingToleranceKm: 3, maxPois: 4, status: 'OPTIMIZED',
      routeName: 'Boğaz Akşam Rotası',
      routeTotalDistanceKm: 2.8, routeTotalDurationMin: 300,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: 'Boğaz manzarası ve akşam yemeği duraklarını birleştiren rota.',
      optimizedAt: new Date('2026-05-19T15:00:00Z'),
      poiPool: [...scenic.slice(0, 2), ...food.slice(0, 2)], stopCount: 3,
    },

    // ── Hasan Öztekin ──────────────────────────────────────────────────────
    {
      userId: hasan,
      title: 'Kapalıçarşı ve Tarihi Çarşılar',
      description: "Kapalıçarşı başta olmak üzere İstanbul'un efsanevi çarşılarında alışveriş turu.",
      date: '2026-05-18', timeStart: '10:00', timeEnd: '19:00',
      categories: ['shopping'], budgetTl: 3000,
      visibility: 'PUBLIC', weather: 'cloudy',
      walkingToleranceKm: 4, maxPois: 5, status: 'OPTIMIZED',
      routeName: 'Tarihi Çarşılar Rotası',
      routeTotalDistanceKm: 3.1, routeTotalDurationMin: 420,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: 'Tarihi çarşıları ve alışveriş meydanlarını kapsayan rota.',
      optimizedAt: new Date('2026-05-17T09:00:00Z'),
      poiPool: shopping, stopCount: 4,
    },
    {
      userId: hasan,
      title: 'Belgrad Ormanı Doğa Kaçamağı',
      description: 'Şehir gürültüsünden uzak, orman yürüyüşü ve piknik alanları.',
      date: '2026-05-25', timeStart: '08:00', timeEnd: '15:00',
      categories: ['nature'], budgetTl: 200,
      visibility: 'PRIVATE', weather: 'clear',
      walkingToleranceKm: 10, maxPois: 3, status: 'OPTIMIZED',
      routeName: 'Doğa Yürüyüş Rotası',
      routeTotalDistanceKm: 7.5, routeTotalDurationMin: 360,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: 'Doğal alanları kapsayan uzun yürüyüş rotası.',
      optimizedAt: new Date('2026-05-24T20:00:00Z'),
      poiPool: nature, stopCount: 3,
    },

    // ── Aziz Yıldırım ──────────────────────────────────────────────────────
    {
      userId: aziz,
      title: 'İstanbul Lezzetleri Rotası',
      description: 'Simit, balık ekmek, börek ve Türk kahvesiyle dolu bir gastronomi turu.',
      date: '2026-06-01', timeStart: '12:00', timeEnd: '20:00',
      categories: ['food'], budgetTl: 600,
      visibility: 'PUBLIC', weather: 'clear',
      walkingToleranceKm: 4, maxPois: 5, status: 'OPTIMIZED',
      routeName: 'Gastronomi Rotası',
      routeTotalDistanceKm: 3.8, routeTotalDurationMin: 420,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: "İstanbul sokaklarında özgün lezzetleri keşfeden rota.",
      optimizedAt: new Date('2026-05-31T18:00:00Z'),
      poiPool: food, stopCount: 4,
    },
    {
      userId: aziz,
      title: 'Galata ve Beyoğlu Kültür Turu',
      description: "Galata Kulesi'nden İstiklal Caddesi'ne uzanan kültür, sanat ve eğlence yolculuğu.",
      date: '2026-06-07', timeStart: '10:00', timeEnd: '17:00',
      categories: ['historical', 'entertainment'], budgetTl: 400,
      visibility: 'PUBLIC', weather: 'cloudy',
      walkingToleranceKm: 5, maxPois: 5, status: 'OPTIMIZED',
      routeName: 'Galata–Beyoğlu Kültür Rotası',
      routeTotalDistanceKm: 2.9, routeTotalDurationMin: 360,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: 'Galata ve Beyoğlu bölgesini kapsayan kültür ve eğlence rotası.',
      optimizedAt: new Date('2026-06-06T10:00:00Z'),
      poiPool: [...historical.slice(2, 4), ...entertainment.slice(0, 2)], stopCount: 3,
    },

    // ── Aykut Kocaman ──────────────────────────────────────────────────────
    {
      userId: aykut,
      title: "Boğaz'ın İki Yakası",
      description: "Avrupa ve Anadolu yakasından Boğaz'ın muhteşem manzaralarını keşfet.",
      date: '2026-06-10', timeStart: '09:00', timeEnd: '18:00',
      categories: ['scenic'], budgetTl: 1200,
      visibility: 'PUBLIC', weather: 'clear',
      walkingToleranceKm: 6, maxPois: 5, status: 'OPTIMIZED',
      routeName: 'Boğaz Panorama Rotası',
      routeTotalDistanceKm: 12.4, routeTotalDurationMin: 480,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: "İki yakayı birleştiren geniş Boğaz panorama rotası.",
      optimizedAt: new Date('2026-06-09T19:00:00Z'),
      poiPool: scenic, stopCount: 4,
    },
    {
      userId: aykut,
      title: 'Tarihi Yarımada Yürüyüşü',
      description: 'Tarihi yarımadanın gizemli sokaklarında yavaş tempolu bir keşif planı.',
      date: '2026-06-15', timeStart: '09:00', timeEnd: '14:00',
      categories: ['historical'], budgetTl: 300,
      visibility: 'PRIVATE', weather: 'rainy',
      walkingToleranceKm: 4, maxPois: 4, status: 'PENDING',
      poiPool: [], stopCount: 0,
    },

    // ── Eda Erdem ──────────────────────────────────────────────────────────
    {
      userId: eda,
      title: "Prens Adaları Kaçamağı",
      description: "Büyükada'da fayton turu, sahil yürüyüşü ve taze deniz ürünleri.",
      date: '2026-06-20', timeStart: '09:00', timeEnd: '17:00',
      categories: ['scenic', 'nature'], budgetTl: 500,
      visibility: 'PUBLIC', weather: 'clear',
      walkingToleranceKm: 6, maxPois: 4, status: 'OPTIMIZED',
      routeName: 'Büyükada Gün Rotası',
      routeTotalDistanceKm: 5.2, routeTotalDurationMin: 420,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: 'Büyükada gezisini kapsayan sakin ve doğal rota.',
      optimizedAt: new Date('2026-06-19T10:00:00Z'),
      poiPool: [...scenic.slice(0, 2), ...nature.slice(0, 2)], stopCount: 3,
    },
    {
      userId: eda,
      title: "İstanbul'da Kahve Kültürü",
      description: "Tarihi mahallelerde butik kahveciler, Türk kahvesi ve modern espresso barları.",
      date: '2026-06-22', timeStart: '10:00', timeEnd: '14:00',
      categories: ['food', 'neighborhood'], budgetTl: 350,
      visibility: 'PUBLIC', weather: 'clear',
      walkingToleranceKm: 3, maxPois: 4, status: 'OPTIMIZED',
      routeName: 'Kahve Keşif Rotası',
      routeTotalDistanceKm: 2.2, routeTotalDurationMin: 240,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: "İstanbul kahve kültürünü keşfeden mahalle rotası.",
      optimizedAt: new Date('2026-06-21T08:00:00Z'),
      poiPool: [...food.slice(0, 2), ...neighborhood.slice(0, 2)], stopCount: 3,
    },
  ];

  const createdTrips: { id: string; userId: string; visibility: string }[] = [];

  for (const spec of tripSpecs) {
    const tripId   = randomUUID();
    const selected = pick(spec.poiPool, spec.stopCount);
    const stops    = buildStops(tripId, selected, spec.timeStart);
    const routeCost = stops.reduce((sum, s) => sum + s.estimatedCostTl, 0) || null;

    await prisma.trip.create({
      data: {
        id: tripId,
        userId: spec.userId,
        title: spec.title,
        description: spec.description,
        date: new Date(spec.date),
        timeStart: spec.timeStart,
        timeEnd: spec.timeEnd,
        budgetTl: spec.budgetTl,
        categories: spec.categories,
        weather: spec.weather,
        walkingToleranceKm: spec.walkingToleranceKm,
        maxPois: spec.maxPois,
        status: spec.status as never,
        visibility: spec.visibility as never,
        routeName: spec.routeName ?? null,
        routeTotalDistanceKm: spec.routeTotalDistanceKm ?? null,
        routeTotalDurationMin: spec.routeTotalDurationMin ?? null,
        routeTotalCostTl: routeCost,
        routeAlgorithmUsed: spec.routeAlgorithmUsed ?? null,
        routeExplanation: spec.routeExplanation ?? null,
        optimizedAt: spec.optimizedAt ?? null,
      },
    });

    if (stops.length > 0) {
      await prisma.tripStop.createMany({ data: stops as never[] });
    }

    createdTrips.push({ id: tripId, userId: spec.userId, visibility: spec.visibility });
    console.log(`  [trip] "${spec.title}" — ${spec.visibility}, ${spec.status}, ${stops.length} stops`);
  }

  // ── 5. Follow relationships ───────────────────────────────────────────────

  console.log('\n[demo-seed] Creating follows...');

  const followPairs: [string, string][] = [
    [yusuf, hasan], [yusuf, aziz],
    [hasan, yusuf], [hasan, eda],
    [aziz,  yusuf], [aziz,  aykut],
    [aykut, eda],   [aykut, hasan],
    [eda,   aziz],  [eda,   yusuf],
  ];

  for (const [followerId, followingId] of followPairs) {
    await prisma.userFollow.upsert({
      where:  { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { id: randomUUID(), followerId, followingId },
    });
  }
  console.log(`  ${followPairs.length} follow relationships`);

  // ── 6. Likes on public trips ──────────────────────────────────────────────

  console.log('\n[demo-seed] Adding likes...');

  const publicTrips = createdTrips.filter((t) => t.visibility === 'PUBLIC');
  let likeCount = 0;

  for (const trip of publicTrips) {
    const likers = Object.values(uid).filter((id) => id !== trip.userId).slice(0, 2);
    for (const userId of likers) {
      await prisma.tripLike.upsert({
        where:  { tripId_userId: { tripId: trip.id, userId } },
        update: {},
        create: { id: randomUUID(), tripId: trip.id, userId },
      });
      likeCount++;
    }
  }
  console.log(`  ${likeCount} likes across ${publicTrips.length} public trips`);

  // ── 7. Comments on first 3 public trips ──────────────────────────────────

  console.log('\n[demo-seed] Adding comments...');

  const sampleComments = [
    'Harika bir rota, kesinlikle deneyeceğim!',
    'Geçen hafta gittim, muhteşemdi.',
    'Bu rotayı çok beğendim, paylaşım için teşekkürler!',
  ];

  let commentCount = 0;
  for (let i = 0; i < Math.min(sampleComments.length, publicTrips.length); i++) {
    const trip      = publicTrips[i];
    const commenter = Object.values(uid).find((id) => id !== trip.userId)!;
    await prisma.tripComment.create({
      data: { id: randomUUID(), tripId: trip.id, userId: commenter, body: sampleComments[i] },
    });
    commentCount++;
  }
  console.log(`  ${commentCount} comments`);

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`
[demo-seed] Done ✓

  Users    : ${DEMO_USERS.length}
  Trips    : ${tripSpecs.length} (${tripSpecs.filter((t) => t.status === 'OPTIMIZED').length} optimized, ${tripSpecs.filter((t) => t.visibility === 'PUBLIC').length} public)
  Follows  : ${followPairs.length}
  Likes    : ${likeCount}
  Comments : ${commentCount}
`);
}

main()
  .catch((err) => {
    console.error('[demo-seed] Fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
