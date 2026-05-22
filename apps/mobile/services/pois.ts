import { API_BASE_URL } from '../constants/api';

export type PoiItem = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  district: string | null;
  address: string | null;
  imageUrl: string | null;
  source: string | null;
  coordinates: { lat: number; lng: number };
  suggestedVisitDurationMinutes: number;
  pricing: { budgetLevel: string; minTl: number | null; maxTl: number | null };
  openingHours: { open: string; close: string };
};

export type ListPoisResponse = {
  items: PoiItem[];
  meta: {
    total: number;
    limit: number;
    filters: { category: string | null; search: string | null };
  };
};

export const POI_CATEGORIES = [
  'historical',
  'scenic',
  'food',
  'shopping',
  'nature',
  'neighborhood',
  'entertainment',
] as const;

export type PoiCategory = (typeof POI_CATEGORIES)[number];

export async function listPois(params?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<ListPoisResponse> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search?.trim()) searchParams.set('search', params.search.trim());
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  const response = await fetch(
    `${API_BASE_URL}/pois${qs ? `?${qs}` : ''}`,
  );

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // ignore
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || 'Failed to load POIs');
  }

  return payload.data as ListPoisResponse;
}
