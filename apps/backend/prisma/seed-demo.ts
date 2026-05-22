/**
 * Demo seed script — creates 10 sample users with rich social data for
 * testing/demo purposes. Requires POIs to already be seeded first.
 *
 * Usage (from apps/backend/):
 *   npm run seed:demo
 *
 * Safe to re-run — upserts users by email, wipes and recreates all
 * trips/social data for demo users on each run.
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function pick<T>(pool: T[], n: number): T[] {
  return pool.slice(0, n);
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
  return poi.budgetLevel === 'LOW'
    ? 50
    : poi.budgetLevel === 'MEDIUM'
      ? 300
      : 1000;
}

function buildStops(
  tripId: string,
  pois: PoiRow[],
  startTime: string,
  travelMin = 15,
): StopData[] {
  let cursor = startTime;
  return pois.map((poi, i) => {
    const arrival = cursor;
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
  {
    email: 'yusuf@test.com',
    password: 'yusuf123',
    displayName: 'Yusuf Enes Şahingöz',
    bio: 'Tarihi rotalar, Boğaz manzaraları ve iyi kahve.',
    travelVibes: ['explorer', 'cultural'],
    favoriteCategories: ['historical', 'scenic'],
  },
  {
    email: 'hasan@test.com',
    password: 'hasan123',
    displayName: 'Hasan Öztekin',
    bio: 'Food hunter. Şehrin gizli lezzetlerini arıyor.',
    travelVibes: ['foodie', 'relaxed'],
    favoriteCategories: ['food', 'neighborhood'],
  },
  {
    email: 'tugce@test.com',
    password: 'tugce123',
    displayName: 'Tuğçe Tepe',
    bio: 'Doğa yürüyüşleri ve sakin köşeler.',
    travelVibes: ['nature-lover', 'relaxed'],
    favoriteCategories: ['nature', 'scenic'],
  },
  {
    email: 'beyza@test.com',
    password: 'beyza123',
    displayName: 'Beyza Nur Köşeli',
    bio: 'Alışveriş rotaları ve mahalle kafe turu.',
    travelVibes: ['social', 'foodie'],
    favoriteCategories: ['shopping', 'neighborhood'],
  },
  {
    email: 'deniz@test.com',
    password: 'deniz123',
    displayName: 'Deniz Meriç',
    bio: "İstanbul'un tarihi dokusunu keşfediyorum.",
    travelVibes: ['cultural', 'explorer'],
    favoriteCategories: ['historical', 'scenic'],
  },
  {
    email: 'badi@test.com',
    password: 'badi1234',
    displayName: 'Ali Emre Yaman',
    bio: 'Boğaz seyiri ve gün batımı peşinde.',
    travelVibes: ['adventurous', 'social'],
    favoriteCategories: ['scenic', 'entertainment'],
  },
  {
    email: 'marsi@test.com',
    password: 'marsi1234',
    displayName: 'Onat Barış Ercan',
    bio: 'Her mahallede bir lezzet keşfi.',
    travelVibes: ['foodie', 'explorer'],
    favoriteCategories: ['food', 'neighborhood'],
  },
  {
    email: 'enti@test.com',
    password: 'enti1234',
    displayName: 'Ali Onat Kılıç',
    bio: 'Tarihi camiler, çeşmeler ve sokak arası.',
    travelVibes: ['cultural', 'relaxed'],
    favoriteCategories: ['historical', 'neighborhood'],
  },
  {
    email: 'arda@test.com',
    password: 'arda1234',
    displayName: 'Arda Yağdı',
    bio: 'Adalar, ormanlar, sahiller.',
    travelVibes: ['nature-lover', 'adventurous'],
    favoriteCategories: ['nature', 'scenic'],
  },
  {
    email: 'yunus@test.com',
    password: 'yunus123',
    displayName: 'Yunus Emre Korkmaz',
    bio: "Gece İstanbul'u ve müzik mekanları.",
    travelVibes: ['social', 'adventurous'],
    favoriteCategories: ['entertainment', 'food'],
  },
] as const;

// Legacy demo users to remove from DB if present
const OLD_DEMO_EMAILS = ['aziz@test.com', 'aykut@test.com', 'eda@test.com'];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  console.log('[demo-seed] Starting...\n');

  // ── 1. Upsert demo users ──────────────────────────────────────────────────

  const uid: Record<string, string> = {};

  for (const u of DEMO_USERS) {
    const passwordHash = await hash(u.password, BCRYPT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        displayName: u.displayName,
        bio: u.bio,
        travelVibes: [...u.travelVibes],
        favoriteCategories: [...u.favoriteCategories],
      },
      create: {
        email: u.email,
        passwordHash,
        displayName: u.displayName,
        bio: u.bio,
        travelVibes: [...u.travelVibes],
        favoriteCategories: [...u.favoriteCategories],
      },
    });
    uid[u.email] = user.id;
    console.log(`  [user] ${u.displayName} (${u.email})`);
  }

  const [yusuf, hasan, tugce, beyza, deniz, badi, marsi, enti, arda, yunus] = [
    uid['yusuf@test.com'],
    uid['hasan@test.com'],
    uid['tugce@test.com'],
    uid['beyza@test.com'],
    uid['deniz@test.com'],
    uid['badi@test.com'],
    uid['marsi@test.com'],
    uid['enti@test.com'],
    uid['arda@test.com'],
    uid['yunus@test.com'],
  ];

  // ── 2. Fetch POI pools by category ───────────────────────────────────────

  console.log('\n[demo-seed] Loading POI pools...');

  const [
    historical,
    scenic,
    food,
    shopping,
    nature,
    entertainment,
    neighborhood,
  ] = await Promise.all([
    prisma.pointOfInterest.findMany({
      where: { category: 'HISTORICAL' },
      take: 12,
      orderBy: { avgDurationMin: 'desc' },
    }),
    prisma.pointOfInterest.findMany({
      where: { category: 'SCENIC' },
      take: 10,
      orderBy: { avgDurationMin: 'desc' },
    }),
    prisma.pointOfInterest.findMany({
      where: { category: 'FOOD' },
      take: 10,
      orderBy: { avgDurationMin: 'asc' },
    }),
    prisma.pointOfInterest.findMany({
      where: { category: 'SHOPPING' },
      take: 8,
      orderBy: { avgDurationMin: 'desc' },
    }),
    prisma.pointOfInterest.findMany({
      where: { category: 'NATURE' },
      take: 8,
      orderBy: { avgDurationMin: 'desc' },
    }),
    prisma.pointOfInterest.findMany({
      where: { category: 'ENTERTAINMENT' },
      take: 8,
      orderBy: { avgDurationMin: 'desc' },
    }),
    prisma.pointOfInterest.findMany({
      where: { category: 'NEIGHBORHOOD' },
      take: 8,
      orderBy: { avgDurationMin: 'desc' },
    }),
  ]);

  console.log(
    `  historical=${historical.length} scenic=${scenic.length} food=${food.length} ` +
      `shopping=${shopping.length} nature=${nature.length} ` +
      `entertainment=${entertainment.length} neighborhood=${neighborhood.length}`,
  );

  // ── 3. Wipe existing demo data ────────────────────────────────────────────

  console.log('\n[demo-seed] Clearing previous demo data...');

  const allDemoEmails = [...OLD_DEMO_EMAILS, ...DEMO_USERS.map((u) => u.email)];
  const existingDemoUsers = await prisma.user.findMany({
    where: { email: { in: allDemoEmails } },
    select: { id: true, email: true },
  });
  const allDemoIds = existingDemoUsers.map((u) => u.id);

  if (allDemoIds.length > 0) {
    await prisma.savedTripCollectionItem.deleteMany({
      where: { collection: { userId: { in: allDemoIds } } },
    });
    await prisma.savedTripCollection.deleteMany({
      where: { userId: { in: allDemoIds } },
    });
    await prisma.savedTrip.deleteMany({
      where: {
        OR: [
          { userId: { in: allDemoIds } },
          { trip: { userId: { in: allDemoIds } } },
        ],
      },
    });
    await prisma.tripCompletion.deleteMany({
      where: { trip: { userId: { in: allDemoIds } } },
    });
    await prisma.tripLike.deleteMany({
      where: { trip: { userId: { in: allDemoIds } } },
    });
    await prisma.tripComment.deleteMany({
      where: { trip: { userId: { in: allDemoIds } } },
    });
    await prisma.tripStop.deleteMany({
      where: { trip: { userId: { in: allDemoIds } } },
    });
    await prisma.trip.deleteMany({ where: { userId: { in: allDemoIds } } });
    await prisma.userFollow.deleteMany({
      where: {
        OR: [
          { followerId: { in: allDemoIds } },
          { followingId: { in: allDemoIds } },
        ],
      },
    });
  }

  const oldDemoIds = existingDemoUsers
    .filter((u) => OLD_DEMO_EMAILS.includes(u.email))
    .map((u) => u.id);
  if (oldDemoIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: oldDemoIds } } });
    console.log(`  Removed ${oldDemoIds.length} legacy demo users`);
  }

  // ── 4. Create trips ───────────────────────────────────────────────────────

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
    visibility: 'PUBLIC' | 'PRIVATE';
    weather: string;
    walkingToleranceKm: number;
    maxPois: number;
    status: 'OPTIMIZED' | 'PENDING';
    creationMode?: 'OPTIMIZED' | 'MANUAL';
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
    // ── Yusuf Enes Şahingöz ───────────────────────────────────────────────
    {
      userId: yusuf,
      title: 'Sultanahmet Sabah Rotası',
      description:
        "Ayasofya'dan başlayıp Topkapı Sarayı'na uzanan klasik tarihi yarımada turu. Sabahın erken saatlerinde kalabalıktan önce en iyi ışıkla gezmek için ideal.",
      date: '2026-05-10',
      timeStart: '09:00',
      timeEnd: '17:00',
      categories: ['historical'],
      budgetTl: 600,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 5,
      maxPois: 4,
      status: 'OPTIMIZED',
      routeName: 'Sultanahmet Tarihi Rota',
      routeTotalDistanceKm: 4.3,
      routeTotalDurationMin: 460,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Sultanahmet bölgesindeki en önemli tarihi yapıları verimli bir yürüyüş rotasıyla birleştiriyor.',
      optimizedAt: new Date('2026-05-09T20:00:00Z'),
      poiPool: historical.slice(0, 5),
      stopCount: 4,
    },
    {
      userId: yusuf,
      title: "Boğaz'da Akşam Keyfi",
      description:
        'Boğaz kıyısında gün batımı seyri, taze balık restoranları ve Ortaköy manzarası.',
      date: '2026-05-20',
      timeStart: '17:00',
      timeEnd: '22:00',
      categories: ['scenic', 'food'],
      budgetTl: 900,
      visibility: 'PRIVATE',
      weather: 'clear',
      walkingToleranceKm: 3,
      maxPois: 3,
      status: 'OPTIMIZED',
      routeName: 'Boğaz Akşam Rotası',
      routeTotalDistanceKm: 2.8,
      routeTotalDurationMin: 300,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Boğaz manzarası ve akşam yemeği duraklarını birleştiren kısa ama keyifli rota.',
      optimizedAt: new Date('2026-05-19T15:00:00Z'),
      poiPool: [...scenic.slice(0, 2), ...food.slice(0, 2)],
      stopCount: 3,
    },

    // ── Hasan Öztekin ─────────────────────────────────────────────────────
    {
      userId: hasan,
      title: "Kadıköy'de Bir Gün",
      description:
        'Kadıköy çarşısından Moda sahiline uzanan tam bir Anadolu yakası lezzet turu. Balık sandviç, yoğurt tatlısı, sahil yürüyüşü.',
      date: '2026-05-12',
      timeStart: '10:00',
      timeEnd: '18:00',
      categories: ['food', 'neighborhood'],
      budgetTl: 500,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 4,
      maxPois: 5,
      status: 'OPTIMIZED',
      routeName: 'Kadıköy Lezzet Rotası',
      routeTotalDistanceKm: 3.6,
      routeTotalDurationMin: 400,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Kadıköy çarşısı ve Moda sahilini birleştiren yemek odaklı rota.',
      optimizedAt: new Date('2026-05-11T18:00:00Z'),
      poiPool: [...food.slice(2, 6), ...neighborhood.slice(0, 2)],
      stopCount: 4,
    },
    {
      userId: hasan,
      title: 'Beyoğlu Gecesi',
      description:
        "İstiklal'den Karaköy'e, canlı barlar ve caz kulüpleriyle dolu bir gece rotası.",
      date: '2026-05-17',
      timeStart: '19:00',
      timeEnd: '23:59',
      categories: ['entertainment', 'food'],
      budgetTl: 800,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 3,
      maxPois: 4,
      status: 'OPTIMIZED',
      creationMode: 'MANUAL',
      routeName: 'Beyoğlu Gece Rotası',
      routeTotalDistanceKm: 2.1,
      routeTotalDurationMin: 300,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Beyoğlu gece hayatının merkezini kapsayan eğlence rotası.',
      optimizedAt: new Date('2026-05-16T10:00:00Z'),
      poiPool: [...entertainment.slice(0, 3), ...food.slice(6, 8)],
      stopCount: 3,
    },

    // ── Tuğçe Tepe ────────────────────────────────────────────────────────
    {
      userId: tugce,
      title: "Adalar'da Huzur",
      description:
        "Büyükada'da arabalar olmadan fayton ve bisikletle sakin bir gün. Sahil yürüyüşü, taze balık ve eski Rum evleri.",
      date: '2026-05-08',
      timeStart: '09:00',
      timeEnd: '17:00',
      categories: ['scenic', 'nature'],
      budgetTl: 450,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 5,
      maxPois: 4,
      status: 'OPTIMIZED',
      routeName: 'Büyükada Gün Rotası',
      routeTotalDistanceKm: 5.1,
      routeTotalDurationMin: 420,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: "Büyükada'nın sakin ve doğal alanlarını kapsayan rota.",
      optimizedAt: new Date('2026-05-07T10:00:00Z'),
      poiPool: [...scenic.slice(1, 4), ...nature.slice(0, 2)],
      stopCount: 4,
    },
    {
      userId: tugce,
      title: 'Belgrad Ormanı Yürüyüşü',
      description:
        'Şehrin gürültüsünden uzak, ormanda sabah yürüyüşü ve piknik.',
      date: '2026-06-01',
      timeStart: '08:00',
      timeEnd: '14:00',
      categories: ['nature'],
      budgetTl: 150,
      visibility: 'PRIVATE',
      weather: 'clear',
      walkingToleranceKm: 10,
      maxPois: 3,
      status: 'OPTIMIZED',
      creationMode: 'MANUAL',
      routeName: 'Belgrad Ormanı Rotası',
      routeTotalDistanceKm: 8.2,
      routeTotalDurationMin: 360,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: 'Uzun yürüyüş ve piknik için orman rotası.',
      optimizedAt: new Date('2026-05-31T20:00:00Z'),
      poiPool: nature.slice(0, 4),
      stopCount: 3,
    },

    // ── Beyza Nur Köşeli ──────────────────────────────────────────────────
    {
      userId: beyza,
      title: 'Tarihi Çarşılar Turu',
      description:
        "Kapalıçarşı'dan Mısır Çarşısı'na, antika dükkânlardan baharat satıcılarına uzanan keyifli alışveriş günü.",
      date: '2026-05-14',
      timeStart: '10:00',
      timeEnd: '19:00',
      categories: ['shopping', 'historical'],
      budgetTl: 2500,
      visibility: 'PUBLIC',
      weather: 'cloudy',
      walkingToleranceKm: 4,
      maxPois: 5,
      status: 'OPTIMIZED',
      routeName: 'Tarihi Çarşılar Rotası',
      routeTotalDistanceKm: 3.2,
      routeTotalDurationMin: 440,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Tarihi çarşıları ve alışveriş meydanlarını kapsayan rota.',
      optimizedAt: new Date('2026-05-13T09:00:00Z'),
      poiPool: [...shopping.slice(0, 4), ...historical.slice(7, 9)],
      stopCount: 4,
    },
    {
      userId: beyza,
      title: 'Balat & Fener Keşfi',
      description:
        'Renkli evleri, Rum kilisesi ve bohem kafeleriyle Balat sokaklarında kaybolmak.',
      date: '2026-05-19',
      timeStart: '11:00',
      timeEnd: '16:00',
      categories: ['neighborhood', 'historical'],
      budgetTl: 300,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 3,
      maxPois: 4,
      status: 'OPTIMIZED',
      creationMode: 'MANUAL',
      routeName: 'Balat-Fener Yürüyüş Rotası',
      routeTotalDistanceKm: 2.4,
      routeTotalDurationMin: 300,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Balat ve Fener mahallelerini kapsayan tarihi yürüyüş rotası.',
      optimizedAt: new Date('2026-05-18T08:00:00Z'),
      poiPool: [...neighborhood.slice(0, 3), ...historical.slice(5, 7)],
      stopCount: 3,
    },

    // ── Deniz Meriç ───────────────────────────────────────────────────────
    {
      userId: deniz,
      title: 'Tarihi Yarımada Tam Turu',
      description:
        "İstanbul'un binlerce yıllık tarihine tam anlamıyla dalmak için kapsamlı bir rota. Topkapı'dan Kapalıçarşı'ya.",
      date: '2026-05-11',
      timeStart: '09:00',
      timeEnd: '18:00',
      categories: ['historical'],
      budgetTl: 700,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 6,
      maxPois: 5,
      status: 'OPTIMIZED',
      routeName: 'Tarihi Yarımada Rotası',
      routeTotalDistanceKm: 5.4,
      routeTotalDurationMin: 500,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Tarihi yarımadanın tüm önemli yapılarını kapsayan kapsamlı rota.',
      optimizedAt: new Date('2026-05-10T12:00:00Z'),
      poiPool: historical.slice(0, 6),
      stopCount: 5,
    },
    {
      userId: deniz,
      title: 'Galata & Karaköy Kültür Turu',
      description:
        "Galata Kulesi'nin eteklerinden Boğaz manzarasına uzanan sanat galerileri ve tarihi mekanlar.",
      date: '2026-05-16',
      timeStart: '10:00',
      timeEnd: '16:00',
      categories: ['historical', 'scenic'],
      budgetTl: 400,
      visibility: 'PUBLIC',
      weather: 'cloudy',
      walkingToleranceKm: 4,
      maxPois: 4,
      status: 'OPTIMIZED',
      routeName: 'Galata-Karaköy Rotası',
      routeTotalDistanceKm: 3.0,
      routeTotalDurationMin: 360,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        "Galata ve Karaköy'ü birleştiren kültür ve manzara rotası.",
      optimizedAt: new Date('2026-05-15T10:00:00Z'),
      poiPool: [...historical.slice(3, 6), ...scenic.slice(3, 5)],
      stopCount: 4,
    },

    // ── Ali Emre Yaman (badi) ─────────────────────────────────────────────
    {
      userId: badi,
      title: 'Boğaz Panorama Turu',
      description:
        "Rumeli Hisarı'ndan Ortaköy'e Boğaz'ın iki yakasını gören en iyi seyir noktaları.",
      date: '2026-05-09',
      timeStart: '09:00',
      timeEnd: '18:00',
      categories: ['scenic'],
      budgetTl: 1000,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 6,
      maxPois: 5,
      status: 'OPTIMIZED',
      routeName: 'Boğaz Panorama Rotası',
      routeTotalDistanceKm: 11.8,
      routeTotalDurationMin: 480,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        "Boğaz'ın en güzel seyir noktalarını kapsayan kapsamlı panorama rotası.",
      optimizedAt: new Date('2026-05-08T19:00:00Z'),
      poiPool: scenic.slice(0, 6),
      stopCount: 4,
    },
    {
      userId: badi,
      title: 'Ortaköy & Beşiktaş Akşamı',
      description:
        "Ortaköy meydanından Beşiktaş'a yürüyerek sokak lezzetleri ve Boğaz keyfi.",
      date: '2026-05-18',
      timeStart: '16:00',
      timeEnd: '21:00',
      categories: ['scenic', 'neighborhood'],
      budgetTl: 400,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 3,
      maxPois: 3,
      status: 'OPTIMIZED',
      creationMode: 'MANUAL',
      routeName: 'Ortaköy-Beşiktaş Yürüyüş Rotası',
      routeTotalDistanceKm: 2.3,
      routeTotalDurationMin: 300,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Ortaköy ve Beşiktaş arasındaki Boğaz sahilini kapsayan akşam rotası.',
      optimizedAt: new Date('2026-05-17T12:00:00Z'),
      poiPool: [...scenic.slice(3, 5), ...neighborhood.slice(2, 4)],
      stopCount: 3,
    },

    // ── Onat Barış Ercan (marsi) ──────────────────────────────────────────
    {
      userId: marsi,
      title: 'İstanbul Gastronomi Rotası',
      description:
        'Simit, balık ekmek, çiğ köfte ve Türk kahvesi. İstanbul sokaklarının en otantik lezzetleri.',
      date: '2026-05-13',
      timeStart: '11:00',
      timeEnd: '19:00',
      categories: ['food'],
      budgetTl: 550,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 4,
      maxPois: 5,
      status: 'OPTIMIZED',
      routeName: 'Gastronomi Rotası',
      routeTotalDistanceKm: 3.7,
      routeTotalDurationMin: 420,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'İstanbul sokaklarının en iyi lezzetlerini sunan gastronomi rotası.',
      optimizedAt: new Date('2026-05-12T09:00:00Z'),
      poiPool: food.slice(0, 6),
      stopCount: 5,
    },
    {
      userId: marsi,
      title: 'Balat Fotoğraf Turu',
      description:
        "Renkli kapılar, çamaşır ipleri ve tarihi dokularıyla Balat'ın en ikonografik sokakları.",
      date: '2026-05-21',
      timeStart: '10:00',
      timeEnd: '14:00',
      categories: ['neighborhood'],
      budgetTl: 200,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 3,
      maxPois: 4,
      status: 'OPTIMIZED',
      creationMode: 'MANUAL',
      routeName: 'Balat Fotoğraf Rotası',
      routeTotalDistanceKm: 2.0,
      routeTotalDurationMin: 240,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Balat mahallesi fotoğraf noktalarını kapsayan yürüyüş rotası.',
      optimizedAt: new Date('2026-05-20T08:00:00Z'),
      poiPool: neighborhood.slice(0, 5),
      stopCount: 4,
    },

    // ── Ali Onat Kılıç (enti) ─────────────────────────────────────────────
    {
      userId: enti,
      title: 'Eyüp Sultan & Haliç Turu',
      description:
        "Eyüp Sultan Camii'nden Pierre Loti tepesine, Haliç'in büyüleyici manzarasıyla biten ruhani bir yolculuk.",
      date: '2026-05-15',
      timeStart: '09:00',
      timeEnd: '15:00',
      categories: ['historical', 'neighborhood'],
      budgetTl: 250,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 4,
      maxPois: 4,
      status: 'OPTIMIZED',
      routeName: 'Eyüp-Haliç Rotası',
      routeTotalDistanceKm: 3.5,
      routeTotalDurationMin: 360,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Eyüp Sultan ve Haliç kıyısını kapsayan tarihi yürüyüş rotası.',
      optimizedAt: new Date('2026-05-14T15:00:00Z'),
      poiPool: [...historical.slice(6, 9), ...neighborhood.slice(4, 6)],
      stopCount: 4,
    },
    {
      userId: enti,
      title: 'Beşiktaş Günü',
      description:
        "Dolmabahçe'den Çırağan'a sahil yürüyüşü, balık pişiricileri ve mahalle lokantalı bir gün.",
      date: '2026-05-22',
      timeStart: '10:00',
      timeEnd: '16:00',
      categories: ['neighborhood', 'food'],
      budgetTl: 400,
      visibility: 'PRIVATE',
      weather: 'clear',
      walkingToleranceKm: 3,
      maxPois: 4,
      status: 'OPTIMIZED',
      routeName: 'Beşiktaş Sahil Rotası',
      routeTotalDistanceKm: 2.9,
      routeTotalDurationMin: 360,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Beşiktaş ve Dolmabahçe kıyısını kapsayan mahalle rotası.',
      optimizedAt: new Date('2026-05-21T18:00:00Z'),
      poiPool: [...neighborhood.slice(2, 5), ...food.slice(4, 6)],
      stopCount: 3,
    },

    // ── Arda Yağdı ────────────────────────────────────────────────────────
    {
      userId: arda,
      title: 'Büyükada Keşfi',
      description:
        "İstanbul'un en büyük adası Büyükada'da araç yok, gürültü yok. Sadece fayton, deniz ve huzur.",
      date: '2026-05-07',
      timeStart: '08:30',
      timeEnd: '17:00',
      categories: ['scenic', 'nature'],
      budgetTl: 500,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 6,
      maxPois: 4,
      status: 'OPTIMIZED',
      routeName: 'Büyükada Keşif Rotası',
      routeTotalDistanceKm: 6.3,
      routeTotalDurationMin: 510,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        "Büyükada'nın doğal ve tarihi güzelliklerini kapsayan kapsamlı rota.",
      optimizedAt: new Date('2026-05-06T20:00:00Z'),
      poiPool: [...scenic.slice(0, 3), ...nature.slice(0, 2)],
      stopCount: 4,
    },
    {
      userId: arda,
      title: 'Sarıyer & Kuzey Boğaz',
      description:
        "Kuzey Boğaz'ın sessiz balıkçı köyleri, ormanlık alanlar ve taze uskumru.",
      date: '2026-05-20',
      timeStart: '09:00',
      timeEnd: '15:00',
      categories: ['nature', 'scenic'],
      budgetTl: 350,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 5,
      maxPois: 4,
      status: 'OPTIMIZED',
      creationMode: 'MANUAL',
      routeName: 'Kuzey Boğaz Doğa Rotası',
      routeTotalDistanceKm: 5.8,
      routeTotalDurationMin: 360,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation: 'Sarıyer ve kuzey Boğaz kıyısını kapsayan doğa rotası.',
      optimizedAt: new Date('2026-05-19T18:00:00Z'),
      poiPool: [...nature.slice(2, 5), ...scenic.slice(4, 6)],
      stopCount: 3,
    },

    // ── Yunus Emre Korkmaz ────────────────────────────────────────────────
    {
      userId: yunus,
      title: 'Karaköy Sanat & Kültür',
      description:
        "Galataport'tan Karaköy'ün underground müzik mekanlarına, çağdaş sanat galerilerine.",
      date: '2026-05-18',
      timeStart: '12:00',
      timeEnd: '20:00',
      categories: ['entertainment', 'neighborhood'],
      budgetTl: 600,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 3,
      maxPois: 4,
      status: 'OPTIMIZED',
      routeName: 'Karaköy Sanat Rotası',
      routeTotalDistanceKm: 2.2,
      routeTotalDurationMin: 480,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        'Karaköy ve Galataport sanat mekanlarını kapsayan kültür rotası.',
      optimizedAt: new Date('2026-05-17T10:00:00Z'),
      poiPool: [...entertainment.slice(0, 3), ...neighborhood.slice(5, 7)],
      stopCount: 4,
    },
    {
      userId: yunus,
      title: 'Taksim & İstiklal Caddesi',
      description:
        "İstiklal'in ikonik pasajları, Çiçek Pasajı ve gece müzik mekanları. Şehrin kalp atışı.",
      date: '2026-05-22',
      timeStart: '14:00',
      timeEnd: '23:00',
      categories: ['entertainment', 'shopping'],
      budgetTl: 900,
      visibility: 'PUBLIC',
      weather: 'clear',
      walkingToleranceKm: 4,
      maxPois: 4,
      status: 'OPTIMIZED',
      routeName: 'İstiklal Caddesi Rotası',
      routeTotalDistanceKm: 3.1,
      routeTotalDurationMin: 540,
      routeAlgorithmUsed: 'greedy_nearest',
      routeExplanation:
        "Taksim ve İstiklal Caddesi'ni kapsayan eğlence ve alışveriş rotası.",
      optimizedAt: new Date('2026-05-21T12:00:00Z'),
      poiPool: [...entertainment.slice(3, 6), ...shopping.slice(4, 6)],
      stopCount: 4,
    },
  ];

  const createdTrips: {
    id: string;
    userId: string;
    title: string;
    visibility: string;
  }[] = [];

  for (const spec of tripSpecs) {
    const tripId = randomUUID();
    const selected = pick(spec.poiPool, spec.stopCount);
    const stops = buildStops(tripId, selected, spec.timeStart);
    const routeCost =
      stops.reduce((sum, s) => sum + s.estimatedCostTl, 0) || null;

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
        creationMode: (spec.creationMode ?? 'OPTIMIZED') as never,
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

    createdTrips.push({
      id: tripId,
      userId: spec.userId,
      title: spec.title,
      visibility: spec.visibility,
    });
    console.log(
      `  [trip] "${spec.title}" — ${spec.visibility}, ${spec.creationMode ?? 'OPTIMIZED'}, ${stops.length} stops`,
    );
  }

  // ── 5. Follow relationships ───────────────────────────────────────────────

  console.log('\n[demo-seed] Creating follow relationships...');

  const followPairs: [string, string][] = [
    [yusuf, hasan],
    [yusuf, tugce],
    [yusuf, deniz],
    [yusuf, beyza],
    [hasan, yusuf],
    [hasan, badi],
    [hasan, marsi],
    [hasan, arda],
    [tugce, yusuf],
    [tugce, beyza],
    [tugce, deniz],
    [tugce, enti],
    [beyza, tugce],
    [beyza, hasan],
    [beyza, yunus],
    [beyza, marsi],
    [deniz, yusuf],
    [deniz, hasan],
    [deniz, badi],
    [badi, yusuf],
    [badi, marsi],
    [badi, arda],
    [badi, deniz],
    [marsi, badi],
    [marsi, deniz],
    [marsi, hasan],
    [marsi, beyza],
    [enti, yusuf],
    [enti, tugce],
    [enti, arda],
    [arda, badi],
    [arda, yunus],
    [arda, marsi],
    [yunus, marsi],
    [yunus, deniz],
    [yunus, arda],
    [yunus, beyza],
    [yunus, hasan],
  ];

  for (const [followerId, followingId] of followPairs) {
    await prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { id: randomUUID(), followerId, followingId },
    });
  }
  console.log(`  ${followPairs.length} follow relationships`);

  // ── 6. Likes ──────────────────────────────────────────────────────────────

  console.log('\n[demo-seed] Adding likes...');

  const byTitle = (title: string) =>
    createdTrips.find((t) => t.title === title)?.id;

  const likePlan: [string | undefined, string[]][] = [
    [
      byTitle('Sultanahmet Sabah Rotası'),
      [hasan, deniz, tugce, beyza, badi, enti],
    ],
    [
      byTitle('Tarihi Yarımada Tam Turu'),
      [yusuf, tugce, badi, marsi, yunus, arda],
    ],
    [byTitle('Boğaz Panorama Turu'), [hasan, yusuf, deniz, beyza, enti, yunus]],
    [byTitle('İstanbul Gastronomi Rotası'), [beyza, hasan, tugce, badi, arda]],
    [byTitle("Kadıköy'de Bir Gün"), [yusuf, tugce, marsi, arda, enti]],
    [byTitle('Tarihi Çarşılar Turu'), [yusuf, deniz, marsi, yunus]],
    [byTitle("Adalar'da Huzur"), [yusuf, deniz, beyza, enti]],
    [byTitle('Büyükada Keşfi'), [hasan, deniz, badi, yunus]],
    [byTitle('Galata & Karaköy Kültür Turu'), [yusuf, tugce, marsi]],
    [byTitle('Beyoğlu Gecesi'), [yusuf, badi, arda]],
    [byTitle('Balat & Fener Keşfi'), [yusuf, marsi, yunus]],
    [byTitle('Balat Fotoğraf Turu'), [hasan, deniz]],
    [byTitle('Ortaköy & Beşiktaş Akşamı'), [marsi, yunus]],
    [byTitle('Eyüp Sultan & Haliç Turu'), [tugce, beyza]],
    [byTitle('Sarıyer & Kuzey Boğaz'), [hasan, enti]],
    [byTitle('Karaköy Sanat & Kültür'), [deniz, beyza]],
    [byTitle('Taksim & İstiklal Caddesi'), [marsi, badi]],
  ];

  let likeCount = 0;
  for (const [tripId, likers] of likePlan) {
    if (!tripId) continue;
    const trip = createdTrips.find((t) => t.id === tripId);
    for (const userId of likers) {
      if (trip?.userId === userId) continue;
      await prisma.tripLike.upsert({
        where: { tripId_userId: { tripId, userId } },
        update: {},
        create: { id: randomUUID(), tripId, userId },
      });
      likeCount++;
    }
  }
  console.log(`  ${likeCount} likes`);

  // ── 7. Comments ───────────────────────────────────────────────────────────

  console.log('\n[demo-seed] Adding comments...');

  type CommentSpec = { tripTitle: string; userId: string; body: string };
  const commentSpecs: CommentSpec[] = [
    {
      tripTitle: 'Sultanahmet Sabah Rotası',
      userId: hasan,
      body: 'Sabah erken gitmenin ne kadar fark yarattığını bu rota ile anladım. Kesinlikle deneyeceğim!',
    },
    {
      tripTitle: 'Sultanahmet Sabah Rotası',
      userId: deniz,
      body: 'The walking distance is very manageable. Perfect for a first-time Istanbul visitor.',
    },
    {
      tripTitle: 'Sultanahmet Sabah Rotası',
      userId: tugce,
      body: 'Hafta sonu için kaydettim, çok iyi bir plan.',
    },
    {
      tripTitle: 'Tarihi Yarımada Tam Turu',
      userId: yusuf,
      body: 'Kapsamlı bir rota! Tüm günü dolduruyor ama her durak değer.',
    },
    {
      tripTitle: 'Tarihi Yarımada Tam Turu',
      userId: badi,
      body: 'I did a similar route last month — the route explanation is spot on.',
    },
    {
      tripTitle: 'Tarihi Yarımada Tam Turu',
      userId: marsi,
      body: 'Tarihi yarımadayı bu kadar verimli gösteren başka bir rota görmedim.',
    },
    {
      tripTitle: 'Boğaz Panorama Turu',
      userId: hasan,
      body: 'Gün batımı saati için harika bir rota. Fotoğrafçılar için ideal!',
    },
    {
      tripTitle: 'Boğaz Panorama Turu',
      userId: deniz,
      body: 'Mesafe biraz fazla ama manzara her adıma değiyor.',
    },
    {
      tripTitle: "Kadıköy'de Bir Gün",
      userId: yusuf,
      body: 'Kadıköy çarşısı bu rotanın en iyi noktası. Tezgahlara doğrudan dalın.',
    },
    {
      tripTitle: "Kadıköy'de Bir Gün",
      userId: marsi,
      body: 'Tried this last weekend. The food stops are amazing — worth every kuruş.',
    },
    {
      tripTitle: 'İstanbul Gastronomi Rotası',
      userId: beyza,
      body: "Harika bir yemek turu! Simit ve çay kombinasyonu için Eminönü'ye gitmeyi öneririm.",
    },
    {
      tripTitle: 'İstanbul Gastronomi Rotası',
      userId: tugce,
      body: 'Bu rota midemi ağlattı, gitmek zorundayım.',
    },
    {
      tripTitle: "Adalar'da Huzur",
      userId: deniz,
      body: 'Büyükada için mükemmel bir plan. Fayton için önceden rezervasyon yapın!',
    },
    {
      tripTitle: "Adalar'da Huzur",
      userId: yusuf,
      body: 'Şehrin gürültüsünden kaçmak için ideal. Saving this for my next day off.',
    },
    {
      tripTitle: 'Balat & Fener Keşfi',
      userId: marsi,
      body: 'Balat sokakları fotoğraf için paha biçilemez. Erken gidip gün ışığını yakalayın.',
    },
    {
      tripTitle: 'Beyoğlu Gecesi',
      userId: badi,
      body: "Caz kulüpleri için Asmalımescit'i de ekleyin, rota daha da iyi olur.",
    },
    {
      tripTitle: 'Büyükada Keşfi',
      userId: hasan,
      body: "Ada'da sabah erkenden taze balık yemek başlı başına bir deneyim.",
    },
    {
      tripTitle: 'Büyükada Keşfi',
      userId: deniz,
      body: 'Loved this route. Very easy walking distance for a full island day.',
    },
    {
      tripTitle: 'Galata & Karaköy Kültür Turu',
      userId: yusuf,
      body: "Galata Kulesi'nden Karaköy'e yürüyüş harika, ama çıkışta kuyruk olabiliyor.",
    },
    {
      tripTitle: 'Balat Fotoğraf Turu',
      userId: hasan,
      body: 'Bu sokakları görmek için tek başıma da gitsem bu rotayı kullanırım.',
    },
    {
      tripTitle: 'Sarıyer & Kuzey Boğaz',
      userId: enti,
      body: "Sarıyer'de sabah balık ekmek + çay = İstanbul'un özü.",
    },
    {
      tripTitle: 'Karaköy Sanat & Kültür',
      userId: deniz,
      body: "Galataport'un sanat alanları bu rotayı çok özel kılıyor.",
    },
    {
      tripTitle: 'Taksim & İstiklal Caddesi',
      userId: marsi,
      body: "İstiklal'in pasajlarına girip kaybolmak en büyük keyif.",
    },
    {
      tripTitle: 'Eyüp Sultan & Haliç Turu',
      userId: tugce,
      body: "Pierre Loti'den gün batımına bakmak unutulmaz. Harika rota!",
    },
    {
      tripTitle: 'Tarihi Çarşılar Turu',
      userId: deniz,
      body: "Kapalıçarşı'da pazarlık tüyoları için rehber almayı düşünün.",
    },
  ];

  let commentCount = 0;
  for (const spec of commentSpecs) {
    const trip = createdTrips.find((t) => t.title === spec.tripTitle);
    if (!trip) continue;
    await prisma.tripComment.create({
      data: {
        id: randomUUID(),
        tripId: trip.id,
        userId: spec.userId,
        body: spec.body,
      },
    });
    commentCount++;
  }
  console.log(`  ${commentCount} comments`);

  // ── 8. Saves ──────────────────────────────────────────────────────────────

  console.log('\n[demo-seed] Adding saves...');

  type SaveSpec = { saver: string; tripTitle: string };
  const saveSpecs: SaveSpec[] = [
    { saver: yusuf, tripTitle: "Adalar'da Huzur" },
    { saver: yusuf, tripTitle: 'Tarihi Yarımada Tam Turu' },
    { saver: yusuf, tripTitle: 'Boğaz Panorama Turu' },
    { saver: hasan, tripTitle: 'Sultanahmet Sabah Rotası' },
    { saver: hasan, tripTitle: 'Büyükada Keşfi' },
    { saver: hasan, tripTitle: 'İstanbul Gastronomi Rotası' },
    { saver: tugce, tripTitle: 'Sultanahmet Sabah Rotası' },
    { saver: tugce, tripTitle: 'Balat & Fener Keşfi' },
    { saver: tugce, tripTitle: 'Sarıyer & Kuzey Boğaz' },
    { saver: beyza, tripTitle: "Kadıköy'de Bir Gün" },
    { saver: beyza, tripTitle: 'Balat Fotoğraf Turu' },
    { saver: beyza, tripTitle: 'İstanbul Gastronomi Rotası' },
    { saver: deniz, tripTitle: 'Boğaz Panorama Turu' },
    { saver: deniz, tripTitle: "Adalar'da Huzur" },
    { saver: badi, tripTitle: 'Tarihi Yarımada Tam Turu' },
    { saver: badi, tripTitle: 'İstanbul Gastronomi Rotası' },
    { saver: marsi, tripTitle: 'Sultanahmet Sabah Rotası' },
    { saver: marsi, tripTitle: "Kadıköy'de Bir Gün" },
    { saver: enti, tripTitle: "Adalar'da Huzur" },
    { saver: enti, tripTitle: 'Galata & Karaköy Kültür Turu' },
    { saver: arda, tripTitle: 'Boğaz Panorama Turu' },
    { saver: arda, tripTitle: 'Balat Fotoğraf Turu' },
    { saver: yunus, tripTitle: 'Beyoğlu Gecesi' },
    { saver: yunus, tripTitle: 'Ortaköy & Beşiktaş Akşamı' },
    { saver: yunus, tripTitle: 'Tarihi Yarımada Tam Turu' },
  ];

  const savedTripIds: Record<string, string> = {};
  let saveCount = 0;

  for (const spec of saveSpecs) {
    const trip = createdTrips.find((t) => t.title === spec.tripTitle);
    if (!trip || trip.userId === spec.saver) continue;
    const saved = await prisma.savedTrip.upsert({
      where: { tripId_userId: { tripId: trip.id, userId: spec.saver } },
      update: {},
      create: { id: randomUUID(), tripId: trip.id, userId: spec.saver },
    });
    savedTripIds[`${spec.saver}:${spec.tripTitle}`] = saved.id;
    saveCount++;
  }
  console.log(`  ${saveCount} saves`);

  // ── 9. Collections ────────────────────────────────────────────────────────

  console.log('\n[demo-seed] Creating collections...');

  type CollectionSpec = {
    userId: string;
    name: string;
    items: { saver: string; tripTitle: string }[];
  };

  const collectionSpecs: CollectionSpec[] = [
    {
      userId: yusuf,
      name: 'Tarihi Rotalar',
      items: [
        { saver: yusuf, tripTitle: 'Tarihi Yarımada Tam Turu' },
        { saver: yusuf, tripTitle: 'Boğaz Panorama Turu' },
      ],
    },
    {
      userId: hasan,
      name: 'Yemek Rotaları',
      items: [
        { saver: hasan, tripTitle: 'İstanbul Gastronomi Rotası' },
        { saver: hasan, tripTitle: 'Sultanahmet Sabah Rotası' },
      ],
    },
    {
      userId: tugce,
      name: 'Hafta Sonu Planları',
      items: [
        { saver: tugce, tripTitle: 'Sultanahmet Sabah Rotası' },
        { saver: tugce, tripTitle: 'Balat & Fener Keşfi' },
        { saver: tugce, tripTitle: 'Sarıyer & Kuzey Boğaz' },
      ],
    },
    {
      userId: beyza,
      name: 'Coffee & Food Routes',
      items: [
        { saver: beyza, tripTitle: "Kadıköy'de Bir Gün" },
        { saver: beyza, tripTitle: 'İstanbul Gastronomi Rotası' },
      ],
    },
    {
      userId: deniz,
      name: 'Scenic Istanbul',
      items: [
        { saver: deniz, tripTitle: 'Boğaz Panorama Turu' },
        { saver: deniz, tripTitle: "Adalar'da Huzur" },
      ],
    },
    {
      userId: yunus,
      name: 'Gece Planları',
      items: [
        { saver: yunus, tripTitle: 'Beyoğlu Gecesi' },
        { saver: yunus, tripTitle: 'Ortaköy & Beşiktaş Akşamı' },
      ],
    },
  ];

  let collectionCount = 0;
  let collectionItemCount = 0;

  for (const spec of collectionSpecs) {
    const collection = await prisma.savedTripCollection.upsert({
      where: { userId_name: { userId: spec.userId, name: spec.name } },
      update: {},
      create: { id: randomUUID(), userId: spec.userId, name: spec.name },
    });
    collectionCount++;

    for (const item of spec.items) {
      const savedTripId = savedTripIds[`${item.saver}:${item.tripTitle}`];
      if (!savedTripId) continue;
      await prisma.savedTripCollectionItem.upsert({
        where: {
          savedTripId_collectionId: {
            savedTripId,
            collectionId: collection.id,
          },
        },
        update: {},
        create: { id: randomUUID(), savedTripId, collectionId: collection.id },
      });
      collectionItemCount++;
    }
  }
  console.log(
    `  ${collectionCount} collections, ${collectionItemCount} collection items`,
  );

  // ── 10. Completions ───────────────────────────────────────────────────────

  console.log('\n[demo-seed] Adding completions...');

  type CompletionSpec = {
    userId: string;
    tripTitle: string;
    feedbackSignals: string[];
  };
  const completionSpecs: CompletionSpec[] = [
    {
      userId: hasan,
      tripTitle: 'Sultanahmet Sabah Rotası',
      feedbackSignals: ['great_route', 'worth_walking', 'perfect_timing'],
    },
    {
      userId: deniz,
      tripTitle: 'Sultanahmet Sabah Rotası',
      feedbackSignals: ['great_route', 'good_food'],
    },
    {
      userId: yusuf,
      tripTitle: 'Tarihi Yarımada Tam Turu',
      feedbackSignals: ['great_route', 'worth_walking'],
    },
    {
      userId: tugce,
      tripTitle: "Adalar'da Huzur",
      feedbackSignals: ['great_route', 'perfect_timing', 'would_repeat'],
    },
    {
      userId: beyza,
      tripTitle: "Kadıköy'de Bir Gün",
      feedbackSignals: ['good_food', 'worth_walking'],
    },
    {
      userId: badi,
      tripTitle: 'Boğaz Panorama Turu',
      feedbackSignals: ['great_route', 'perfect_timing'],
    },
    {
      userId: arda,
      tripTitle: 'Büyükada Keşfi',
      feedbackSignals: ['great_route', 'would_repeat'],
    },
    {
      userId: marsi,
      tripTitle: 'İstanbul Gastronomi Rotası',
      feedbackSignals: ['good_food', 'worth_walking', 'great_route'],
    },
    {
      userId: yusuf,
      tripTitle: 'Boğaz Panorama Turu',
      feedbackSignals: ['great_route'],
    },
    {
      userId: enti,
      tripTitle: 'Galata & Karaköy Kültür Turu',
      feedbackSignals: ['great_route', 'perfect_timing'],
    },
  ];

  let completionCount = 0;
  for (const spec of completionSpecs) {
    const trip = createdTrips.find((t) => t.title === spec.tripTitle);
    if (!trip || trip.userId === spec.userId) continue;
    await prisma.tripCompletion.upsert({
      where: { tripId_userId: { tripId: trip.id, userId: spec.userId } },
      update: {},
      create: {
        id: randomUUID(),
        tripId: trip.id,
        userId: spec.userId,
        feedbackSignals: spec.feedbackSignals,
      },
    });
    completionCount++;
  }
  console.log(`  ${completionCount} completions`);

  // ── Summary ───────────────────────────────────────────────────────────────

  const publicCount = tripSpecs.filter((t) => t.visibility === 'PUBLIC').length;
  const manualCount = tripSpecs.filter(
    (t) => t.creationMode === 'MANUAL',
  ).length;

  console.log(`
[demo-seed] Done ✓

  Users       : ${DEMO_USERS.length}
  Trips       : ${tripSpecs.length} (${publicCount} public, ${manualCount} manual creationMode)
  Follows     : ${followPairs.length}
  Likes       : ${likeCount}
  Saves       : ${saveCount}
  Comments    : ${commentCount}
  Collections : ${collectionCount} (${collectionItemCount} items)
  Completions : ${completionCount}
`);
}

main()
  .catch((err) => {
    console.error('[demo-seed] Fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
