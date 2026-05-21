import { API_BASE_URL } from '../constants/api';

type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
};

type ApiErrorEnvelope = {
  success: false;
  error?: {
    message?: string | string[];
  };
};

export type TripVisibility = 'PRIVATE' | 'PUBLIC';
export type ExploreWeather = 'clear' | 'cloudy' | 'rainy';

export type TripPreview = {
  headline: string;
  subheadline: string | null;
  primaryCategory: string | null;
  districtLabel: string | null;
  stopCount: number;
  hasMapData: boolean;
  hasPoiImage: boolean;
  imageUrl: string | null;
};

export type TripDetailResponse = {
  trip: {
    id: string;
    title: string;
    destination: string | null;
    description: string | null;
    date: string;
    timeStart: string | null;
    timeEnd: string | null;
    budgetTl: number | null;
    categories: string[];
    weather: string | null;
    walkingToleranceKm: number | null;
    maxPois: number | null;
    status: string;
    visibility: TripVisibility;
    coverImageUrl: string | null;
    createdAt: string;
    updatedAt: string;
  };
  optimization: {
    optimizedAt: string | null;
    routeName: string | null;
    routeTotalDistanceKm: number | null;
    routeTotalDurationMin: number | null;
    routeTotalCostTl: number | null;
    routeAlgorithmUsed: string | null;
    routeExplanation: string | null;
    stopCount: number;
    isOptimized: boolean;
  };
  preview: TripPreview;
  stops: Array<{
    id: string;
    order: number;
    title: string;
    arrivalTime: string;
    departureTime: string;
    travelTimeToNextMin: number | null;
    estimatedCostTl: number;
    poi: {
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
  }>;
};

export type TripListItem = {
  id: string;
  userId: string | null;
  title: string;
  destination: string | null;
  description: string | null;
  date: string;
  timeStart: string | null;
  timeEnd: string | null;
  budgetTl: number | null;
  categories: string[];
  weather: string | null;
  walkingToleranceKm: number | null;
  maxPois: number | null;
  status: string;
  visibility: TripVisibility;
  routeName: string | null;
  routeTotalDistanceKm: number | null;
  routeTotalDurationMin: number | null;
  routeTotalCostTl: number | null;
  routeAlgorithmUsed: string | null;
  routeExplanation?: string | null;
  optimizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  preview: TripPreview;
  _count: {
    stops: number;
  };
  engagement?: {
    likeCount: number;
    commentCount: number;
    saveCount: number;
    completionCount: number;
    likedByMe: boolean;
    savedByMe: boolean;
    completedByMe: boolean;
  };
};

export type ExploreTripItem = {
  id: string;
  title: string;
  description: string | null;
  categories: string[];
  routeTotalDurationMin: number | null;
  routeTotalCostTl: number | null;
  optimizedAt: string | null;
  preview: TripPreview;
  creator: {
    id: string | null;
    displayName: string | null;
    avatarUrl?: string | null;
  };
  engagement?: {
    likeCount: number;
    commentCount: number;
    saveCount: number;
    completionCount: number;
    likedByMe: boolean;
    savedByMe: boolean;
    completedByMe: boolean;
  };
};

export type ExploreTripsResponse = {
  items: ExploreTripItem[];
  meta: {
    total: number;
    availableCategories: string[];
    appliedFilters: {
      q: string | null;
      category: string | null;
      budgetMinTl: number | null;
      budgetMaxTl: number | null;
      limit: number;
    };
  };
};

export type ExploreTripsQuery = {
  q?: string;
  category?: string;
  budgetMinTl?: number;
  budgetMaxTl?: number;
  weather?: ExploreWeather;
  limit?: number;
  creatorId?: string;
};

export type CreateTripPayload = {
  title: string;
  destination: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  categories?: string[];
  budgetTl?: number;
  maxWalkingDistanceKm?: number;
  maxStops?: number;
  weather?: 'clear' | 'cloudy' | 'rainy';
};

export type UpdateTripPayload = {
  title?: string;
  destination?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  categories?: string[];
  budgetTl?: number;
  maxWalkingDistanceKm?: number;
  maxStops?: number;
  weather?: string;
  visibility?: TripVisibility;
  coverImageUrl?: string | null;
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const apiPayload = payload as ApiErrorEnvelope;
    const message = apiPayload.error?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
}

async function parseApiResponse<T>(
  response: Response,
  fallbackErrorMessage: string
): Promise<T> {
  let payload: ApiSuccessEnvelope<T> | ApiErrorEnvelope | null = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, fallbackErrorMessage));
  }

  if (!payload || payload.success !== true) {
    throw new Error(getErrorMessage(payload, fallbackErrorMessage));
  }

  return payload.data;
}

function getAuthHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function createTrip(token: string, payload: CreateTripPayload) {
  const response = await fetch(`${API_BASE_URL}/trips`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return parseApiResponse<TripDetailResponse>(response, 'Failed to create trip');
}

export async function optimizeTrip(token: string, tripId: string) {
  const response = await fetch(`${API_BASE_URL}/trips/${tripId}/optimize`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<TripDetailResponse>(
    response,
    'Failed to optimize trip'
  );
}

export async function getTrip(token: string, tripId: string) {
  const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse<TripDetailResponse>(response, 'Failed to load trip');
}

export async function updateTrip(
  token: string,
  tripId: string,
  payload: UpdateTripPayload
) {
  const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return parseApiResponse<TripDetailResponse>(response, 'Failed to update trip');
}

export async function getTrips(token: string) {
  const response = await fetch(`${API_BASE_URL}/trips`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse<TripListItem[]>(response, 'Failed to load trips');
}

export async function getExploreTrips(query: ExploreTripsQuery = {}, token?: string) {
  const searchParams = new URLSearchParams();

  if (query.q?.trim()) {
    searchParams.set('q', query.q.trim());
  }

  if (query.category?.trim()) {
    searchParams.set('category', query.category.trim().toLowerCase());
  }

  if (query.budgetMinTl !== undefined) {
    searchParams.set('budgetMinTl', String(query.budgetMinTl));
  }

  if (query.budgetMaxTl !== undefined) {
    searchParams.set('budgetMaxTl', String(query.budgetMaxTl));
  }

  if (query.weather?.trim()) {
    searchParams.set('weather', query.weather.trim().toLowerCase());
  }

  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  if (query.creatorId?.trim()) {
    searchParams.set('creatorId', query.creatorId.trim());
  }

  const queryString = searchParams.toString();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(
    `${API_BASE_URL}/trips/explore${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      headers,
    }
  );

  return parseApiResponse<ExploreTripsResponse>(
    response,
    'Failed to load explore trips'
  );
}
