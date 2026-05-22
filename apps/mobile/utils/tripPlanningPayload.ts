import type { CreateTripPayload } from '@/services/trips';
import {
  parseNaturalLanguageTrip,
  type ParsedTripPreferences,
} from '@/utils/naturalLanguageTripParser';

export type PlannerBudgetStyle = 'low' | 'medium' | 'high' | '';

export type PlannerPayloadState = {
  title: string;
  destination: string;
  date: string;
  availableTime: string;
  categories: string[];
  budgetStyle: PlannerBudgetStyle;
};

const DEFAULT_TEXT_DESTINATION = 'Beyoğlu';
const DEFAULT_TEXT_START_TIME = '11:00';
const DEFAULT_TEXT_END_TIME = '19:00';
const DEFAULT_TEXT_BUDGET_TL = 6000;
const DEFAULT_TEXT_WALKING_DISTANCE_KM = 8;
const DEFAULT_TEXT_MAX_STOPS = 3;
const BROAD_RELIABLE_CATEGORIES = [
  'food',
  'scenic',
  'entertainment',
  'shopping',
  'culture',
  'history',
];

function formatDateForApi(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTimeRange(value: string) {
  const match = value.trim().match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!match) return {};
  return { startTime: match[1], endTime: match[2] };
}

function parseBudgetTl(value: PlannerBudgetStyle) {
  if (value === 'low') return 2000;
  if (value === 'medium') return 6000;
  if (value === 'high') return 20000;
  return undefined;
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMinutes(value?: string) {
  if (!value) return undefined;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function isEveningStart(startTime?: string) {
  const startMinutes = toMinutes(startTime);
  return startMinutes !== undefined && startMinutes >= 17 * 60;
}

function isSafeDayWindow(startTime?: string, endTime?: string) {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  if (startMinutes === undefined || endMinutes === undefined) return false;

  return startMinutes >= 10 * 60 && startMinutes <= 13 * 60 && endMinutes >= 18 * 60;
}

function buildSmartTitle(parsed: ParsedTripPreferences, destination: string) {
  if (parsed.title?.trim()) return parsed.title.trim();
  return `Smart trip in ${destination}`;
}

function buildBaseTextPayload(parsed: ParsedTripPreferences): CreateTripPayload {
  const destination = parsed.destination ?? DEFAULT_TEXT_DESTINATION;
  const date = parsed.date ?? formatDateForApi(new Date());
  const title = buildSmartTitle(parsed, destination);

  return {
    title,
    destination,
    date,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    categories: parsed.categories ?? [],
    ...(parsed.budgetTl !== undefined && { budgetTl: parsed.budgetTl }),
    ...(parsed.maxWalkingDistanceKm !== undefined && {
      maxWalkingDistanceKm: parsed.maxWalkingDistanceKm,
    }),
    ...(parsed.maxStops !== undefined && { maxStops: parsed.maxStops }),
  };
}

function normalizeSmartPlannerPayload(
  payload: CreateTripPayload
): CreateTripPayload {
  const extractedCategories = payload.categories ?? [];
  const shouldUseSafeWindow =
    !isSafeDayWindow(payload.startTime, payload.endTime) ||
    isEveningStart(payload.startTime);

  return {
    ...payload,
    startTime: shouldUseSafeWindow
      ? DEFAULT_TEXT_START_TIME
      : payload.startTime ?? DEFAULT_TEXT_START_TIME,
    endTime: shouldUseSafeWindow
      ? DEFAULT_TEXT_END_TIME
      : payload.endTime ?? DEFAULT_TEXT_END_TIME,
    categories: dedupe([...BROAD_RELIABLE_CATEGORIES, ...extractedCategories]),
    budgetTl: Math.max(payload.budgetTl ?? 0, DEFAULT_TEXT_BUDGET_TL),
    maxWalkingDistanceKm:
      payload.maxWalkingDistanceKm ?? DEFAULT_TEXT_WALKING_DISTANCE_KM,
    maxStops: Math.min(payload.maxStops ?? DEFAULT_TEXT_MAX_STOPS, DEFAULT_TEXT_MAX_STOPS),
  };
}

export function buildTripPayloadFromPlannerState({
  title,
  destination,
  date,
  availableTime,
  categories,
  budgetStyle,
}: PlannerPayloadState): CreateTripPayload {
  const parsedTimeRange = parseTimeRange(availableTime);
  const parsedBudgetTl = parseBudgetTl(budgetStyle);

  return {
    title: title.trim(),
    destination: destination.trim(),
    date: date.trim(),
    categories,
    ...(parsedBudgetTl !== undefined && { budgetTl: parsedBudgetTl }),
    ...parsedTimeRange,
  };
}

export function buildTripPayloadFromTextPreferences(input: string): CreateTripPayload {
  return buildSmartTripPayloadsFromText(input).adjustedPayload;
}

export function buildSmartTripPayloadsFromText(input: string): {
  extractedPayload: CreateTripPayload;
  adjustedPayload: CreateTripPayload;
  fallbackPayload: CreateTripPayload;
} {
  const parsed = parseNaturalLanguageTrip(input);
  const extractedPayload = buildBaseTextPayload(parsed);
  const adjustedPayload = normalizeSmartPlannerPayload(extractedPayload);
  const fallbackPayload = buildBeyogluFallbackTripPayload(adjustedPayload);

  return { extractedPayload, adjustedPayload, fallbackPayload };
}

export function buildBeyogluFallbackTripPayload(
  payload: CreateTripPayload
): CreateTripPayload {
  return {
    ...payload,
    destination: 'Beyoğlu',
    date: payload.date || formatDateForApi(new Date()),
    startTime: '11:00',
    endTime: '19:00',
    categories: [],
    budgetTl: DEFAULT_TEXT_BUDGET_TL,
    maxWalkingDistanceKm: DEFAULT_TEXT_WALKING_DISTANCE_KM,
    maxStops: DEFAULT_TEXT_MAX_STOPS,
  };
}

export function buildFatihFallbackTripPayload(
  payload: CreateTripPayload
): CreateTripPayload {
  return {
    ...payload,
    destination: 'Fatih',
    date: payload.date || formatDateForApi(new Date()),
    startTime: '10:00',
    endTime: '18:00',
    categories: [],
    budgetTl: DEFAULT_TEXT_BUDGET_TL,
    maxWalkingDistanceKm: DEFAULT_TEXT_WALKING_DISTANCE_KM,
    maxStops: DEFAULT_TEXT_MAX_STOPS,
  };
}

export function buildManualWorkingFallbackTripPayload(): CreateTripPayload {
  return buildTripPayloadFromPlannerState({
    title: 'Istanbul Discovery Trip',
    destination: 'Fatih',
    date: formatDateForApi(new Date()),
    availableTime: '10:00-18:00',
    categories: ['culture', 'food'],
    budgetStyle: 'medium',
  });
}
