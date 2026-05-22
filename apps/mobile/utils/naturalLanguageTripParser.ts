export type ParsedTripPreferences = {
  title?: string;
  destination?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  categories?: string[];
  budgetTl?: number;
  maxWalkingDistanceKm?: number;
  maxStops?: number;
};

type CategoryKeyword = {
  category: string;
  keywords: string[];
};

const CATEGORY_KEYWORDS: CategoryKeyword[] = [
  {
    category: 'culture',
    keywords: ['culture', 'cultural', 'art', 'arts', 'gallery', 'galleries', 'indoor', 'relaxing', 'relaxed', 'kultur', 'kültür', 'kulturel', 'kültürel', 'kapalı', 'kapali', 'sanat', 'rahat', 'sakin'],
  },
  {
    category: 'food',
    keywords: ['food', 'restaurant', 'restaurants', 'dinner', 'lunch', 'eat', 'eating', 'street food', 'yemek', 'restoran', 'akşam yemeği', 'öğle yemeği'],
  },
  {
    category: 'museums',
    keywords: ['museum', 'museums', 'indoor', 'müze', 'müzeler', 'kapalı', 'kapali'],
  },
  {
    category: 'history',
    keywords: ['history', 'historic', 'historical', 'tarih', 'tarihi'],
  },
  {
    category: 'nature',
    keywords: ['nature', 'outdoor', 'park', 'parks', 'walking', 'walk', 'relaxing', 'relaxed', 'doğa', 'doga', 'açık hava', 'acik hava', 'sahil', 'park', 'rahat', 'sakin'],
  },
  {
    category: 'nightlife',
    keywords: ['nightlife', 'bar', 'bars', 'club', 'clubs', 'gece hayatı', 'barlar'],
  },
  {
    category: 'shopping',
    keywords: ['shopping', 'shop', 'shops', 'market', 'bazaar', 'alışveriş', 'alisveris', 'çarşı', 'carsi', 'pazar'],
  },
  {
    category: 'coffee',
    keywords: ['coffee', 'cafe', 'cafes', 'café', 'kahve', 'kafe'],
  },
];

const DESTINATION_KEYWORDS = [
  'Kadıköy',
  'Kadikoy',
  'Moda',
  'Beşiktaş',
  'Besiktas',
  'Sultanahmet',
  'Balat',
  'Taksim',
  'Karaköy',
  'Karakoy',
  'Galata',
  'Üsküdar',
  'Uskudar',
  'Nişantaşı',
  'Nisantasi',
  'Eminönü',
  'Eminonu',
  'Beyoğlu',
  'Beyoglu',
  'Fatih',
  'Ortaköy',
  'Ortakoy',
  'Bebek',
  'Kuzguncuk',
  'Eyüp',
  'Eyup',
];

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  ocak: 0,
  february: 1,
  feb: 1,
  şubat: 1,
  subat: 1,
  march: 2,
  mar: 2,
  mart: 2,
  april: 3,
  apr: 3,
  nisan: 3,
  may: 4,
  mayıs: 4,
  mayis: 4,
  june: 5,
  jun: 5,
  haziran: 5,
  july: 6,
  jul: 6,
  temmuz: 6,
  august: 7,
  aug: 7,
  ağustos: 7,
  agustos: 7,
  september: 8,
  sep: 8,
  eylül: 8,
  eylul: 8,
  october: 9,
  oct: 9,
  ekim: 9,
  november: 10,
  nov: 10,
  kasım: 10,
  kasim: 10,
  december: 11,
  dec: 11,
  aralık: 11,
  aralik: 11,
};

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatDateForApi(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeForApi(hours: number, minutes: number) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addHours(time: string, hoursToAdd: number) {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = Math.min(hours * 60 + minutes + hoursToAdd * 60, 23 * 60);
  return formatTimeForApi(Math.floor(totalMinutes / 60), totalMinutes % 60);
}

function parseDate(text: string) {
  const numericDate = text.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (numericDate) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]) - 1;
    const year = numericDate[3]
      ? Number(numericDate[3].length === 2 ? `20${numericDate[3]}` : numericDate[3])
      : new Date().getFullYear();

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      return formatDateForApi(new Date(year, month, day));
    }
  }

  const monthAlternation = Object.keys(MONTHS).join('|');
  const dayMonth = new RegExp(`\\b(\\d{1,2})\\s+(${monthAlternation})(?:\\s+(\\d{4}))?\\b`, 'i');
  const monthDay = new RegExp(`\\b(${monthAlternation})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`, 'i');
  const dayMonthMatch = normalizeText(text).match(dayMonth);
  const monthDayMatch = normalizeText(text).match(monthDay);

  if (dayMonthMatch) {
    const year = dayMonthMatch[3] ? Number(dayMonthMatch[3]) : new Date().getFullYear();
    return formatDateForApi(new Date(year, MONTHS[dayMonthMatch[2]], Number(dayMonthMatch[1])));
  }

  if (monthDayMatch) {
    const year = monthDayMatch[3] ? Number(monthDayMatch[3]) : new Date().getFullYear();
    return formatDateForApi(new Date(year, MONTHS[monthDayMatch[1]], Number(monthDayMatch[2])));
  }

  return undefined;
}

function parseTime(text: string) {
  const match = text.match(/\b(?:at|saat)?\s*(\d{1,2})(?::|\.)(\d{2})\b/i);
  if (!match) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;

  return formatTimeForApi(hours, minutes);
}

function parseEndTime(text: string, startTime?: string) {
  const rangeMatch = text.match(
    /\b(\d{1,2})(?::|\.)(\d{2})\s*(?:-|to|until|kadar|arası|arasinda|arasında)\s*(\d{1,2})(?::|\.)(\d{2})\b/i
  );

  if (rangeMatch) {
    const hours = Number(rangeMatch[3]);
    const minutes = Number(rangeMatch[4]);
    if (hours <= 23 && minutes <= 59) return formatTimeForApi(hours, minutes);
  }

  const durationMatch = normalizeText(text).match(
    /\b(\d{1,2})\s*(?:hour|hours|saat|saatlik)\b/
  );

  if (durationMatch && startTime) {
    return addHours(startTime, Number(durationMatch[1]));
  }

  return startTime ? addHours(startTime, 4) : undefined;
}

function parseDestination(text: string) {
  const normalizedText = normalizeText(text);
  const destination = DESTINATION_KEYWORDS.find((candidate) =>
    normalizedText.includes(normalizeText(candidate))
  );

  if (!destination) return undefined;

  const preferred = DESTINATION_KEYWORDS.find(
    (candidate) => normalizeText(candidate) === normalizeText(destination)
  );
  return preferred ?? destination;
}

function parseCategories(text: string) {
  const normalizedText = normalizeText(text);
  return CATEGORY_KEYWORDS.filter(({ keywords }) =>
    keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)))
  ).map(({ category }) => category);
}

function parseBudgetTl(text: string) {
  const normalizedText = normalizeText(text);
  const explicitBudget = normalizedText.match(
    /\b(\d{3,6})\s*(?:tl|try|₺|lira)\b/
  );

  if (explicitBudget) return Number(explicitBudget[1]);
  if (/\b(?:low|budget|cheap|affordable|ekonomik|ucuz|dusuk|düşük)\b/.test(normalizedText)) {
    return 2000;
  }
  if (/\b(?:medium|moderate|mid-range|orta)\b/.test(normalizedText)) {
    return 6000;
  }
  if (/\b(?:high|premium|luxury|lüks|luks|pahali|pahalı)\b/.test(normalizedText)) {
    return 20000;
  }

  return undefined;
}

function parsePace(text: string) {
  const normalizedText = normalizeText(text);

  if (/\b(?:slow|relaxed|relaxing|easy|calm|yavas|yavaş|rahat|sakin)\b/.test(normalizedText)) {
    return { maxStops: 3, maxWalkingDistanceKm: 1.5 };
  }

  if (/\b(?:fast|active|packed|intense|hizli|hızlı|aktif|yogun|yoğun)\b/.test(normalizedText)) {
    return { maxStops: 6, maxWalkingDistanceKm: 5 };
  }

  return {};
}

function buildTitle(destination?: string, categories: string[] = []) {
  const primaryCategory = categories[0];
  const label = primaryCategory
    ? primaryCategory.charAt(0).toUpperCase() + primaryCategory.slice(1)
    : 'Smart';

  return destination ? `${label} trip in ${destination}` : `${label} Istanbul trip`;
}

export function parseNaturalLanguageTrip(input: string): ParsedTripPreferences {
  const trimmedInput = input.trim();
  if (!trimmedInput) return {};

  const destination = parseDestination(trimmedInput);
  const date = parseDate(trimmedInput);
  const startTime = parseTime(trimmedInput);
  const endTime = parseEndTime(trimmedInput, startTime);
  const categories = parseCategories(trimmedInput);
  const budgetTl = parseBudgetTl(trimmedInput);
  const pace = parsePace(trimmedInput);

  return {
    ...(destination && { destination }),
    ...(date && { date }),
    ...(startTime && {
      startTime,
      ...(endTime && { endTime }),
    }),
    ...(categories.length > 0 && { categories }),
    ...(budgetTl !== undefined && { budgetTl }),
    ...pace,
    title: buildTitle(destination, categories),
  };
}
