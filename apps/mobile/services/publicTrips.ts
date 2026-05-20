import { API_BASE_URL } from '../constants/api';
import type { TripPreview } from './trips';

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

export type PublicTripComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string | null;
  };
};

export type PublicTripEngagement = {
  likeCount: number;
  commentCount: number;
  saveCount: number;
  completionCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  completedByMe: boolean;
};

export type PublicTripFeedbackSignal = {
  key: string;
  label: string;
};

export type PublicTripFeedback = {
  mine: string[];
  availableSignals: PublicTripFeedbackSignal[];
  summary: Record<string, number>;
};

export type PublicTripSocialRationaleItem = {
  key: string;
  title: string;
  evidence: string;
  count: number;
};

export type PublicTripSocialRationale = {
  items: PublicTripSocialRationaleItem[];
} | null;

export type PublicTripDetailResponse = {
  trip: {
    id: string;
    title: string;
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
    visibility: 'PUBLIC';
    createdAt: string;
    updatedAt: string;
  };
  preview: TripPreview;
  creator: {
    id: string | null;
    displayName: string | null;
    isFollowedByMe: boolean;
    followerCount: number;
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
  engagement: PublicTripEngagement;
  feedback: PublicTripFeedback;
  socialRationale: PublicTripSocialRationale;
  comments: PublicTripComment[];
};

export type PublicTripCommentsResponse = {
  items: PublicTripComment[];
  engagement: PublicTripEngagement;
};

export type PublicTripCommentCreateResponse = {
  comment: PublicTripComment;
  engagement: PublicTripEngagement;
};

export type PublicTripEngagementResponse = {
  engagement: PublicTripEngagement;
};

export type PublicTripRemixResponse = {
  tripId: string;
};

export type PublicTripFeedbackResponse = {
  feedback: PublicTripFeedback;
};

export type SavedTripCollectionMembership = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedTripCollectionSummary = SavedTripCollectionMembership & {
  savedTripCount: number;
};

export type SavedPublicTripItem = {
  savedTripId: string;
  savedAt: string;
  trip: {
    id: string;
    title: string;
    description: string | null;
    date: string;
    categories: string[];
    weather: string | null;
  };
  preview: TripPreview;
  creator: {
    id: string | null;
    displayName: string | null;
    isFollowedByMe: boolean;
    followerCount: number;
  };
  optimization: {
    optimizedAt: string | null;
    routeName: string | null;
    routeTotalDurationMin: number | null;
    routeTotalCostTl: number | null;
  };
  collections: SavedTripCollectionMembership[];
  engagement: PublicTripEngagement;
};

export type ForYouRecommendation = {
  kind: 'personalized' | 'fallback';
  primaryReason: string;
  matchedTraits: string[];
};

export type ForYouSignalSummary = {
  likes: number;
  saves: number;
  completions: number;
  feedbackSubmissions: number;
};

export type ForYouTripItem = {
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
    isFollowedByMe: boolean;
    followerCount: number;
  };
  recommendation: ForYouRecommendation;
  engagement: PublicTripEngagement;
};

export type ForYouTripsResponse = {
  items: ForYouTripItem[];
  meta: {
    personalizationState: 'personalized' | 'cold_start';
    signalSummary: ForYouSignalSummary;
    total: number;
  };
};

export type SavedPublicTripsResponse = {
  collections: SavedTripCollectionSummary[];
  filter: {
    collectionId: string | null;
    selectedCollection: SavedTripCollectionMembership | null;
    totalSavedCount: number;
    ungroupedCount: number;
  };
  items: SavedPublicTripItem[];
};

export type SavedTripCollectionCreateResponse = {
  collection: SavedTripCollectionSummary;
};

export type SavedTripCollectionUpdateResponse = {
  savedTripId: string;
  collections: SavedTripCollectionMembership[];
};

export type SavedTripCollectionDeleteResponse = {
  deletedCollectionId: string;
  name: string;
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

export async function getPublicTrip(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse<PublicTripDetailResponse>(
    response,
    'Failed to load public trip'
  );
}

export async function likePublicTrip(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/likes`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<PublicTripEngagementResponse>(
    response,
    'Failed to like public trip'
  );
}

export async function unlikePublicTrip(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/likes`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<PublicTripEngagementResponse>(
    response,
    'Failed to unlike public trip'
  );
}

export async function getPublicTripComments(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/comments`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse<PublicTripCommentsResponse>(
    response,
    'Failed to load public trip comments'
  );
}

export async function createPublicTripComment(
  id: string,
  token: string,
  body: string
) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/comments`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ body }),
  });

  return parseApiResponse<PublicTripCommentCreateResponse>(
    response,
    'Failed to create public trip comment'
  );
}

export async function savePublicTrip(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/save`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<PublicTripEngagementResponse>(
    response,
    'Failed to save public trip'
  );
}

export async function unsavePublicTrip(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/save`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<PublicTripEngagementResponse>(
    response,
    'Failed to unsave public trip'
  );
}

export async function remixPublicTrip(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/remix`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<PublicTripRemixResponse>(
    response,
    'Failed to remix public trip'
  );
}

export async function completePublicTrip(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/complete`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<PublicTripEngagementResponse>(
    response,
    'Failed to mark public trip as completed'
  );
}

export async function uncompletePublicTrip(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/complete`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<PublicTripEngagementResponse>(
    response,
    'Failed to remove public trip completion'
  );
}

export async function updatePublicTripFeedback(
  id: string,
  token: string,
  signals: string[]
) {
  const response = await fetch(`${API_BASE_URL}/public-trips/${id}/feedback`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ signals }),
  });

  return parseApiResponse<PublicTripFeedbackResponse>(
    response,
    'Failed to update public trip feedback'
  );
}

export async function getSavedPublicTrips(token: string, collectionId?: string) {
  const searchParams = new URLSearchParams();

  if (collectionId?.trim()) {
    searchParams.set('collectionId', collectionId.trim());
  }

  const queryString = searchParams.toString();
  const response = await fetch(
    `${API_BASE_URL}/public-trips/saved${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return parseApiResponse<SavedPublicTripsResponse>(
    response,
    'Failed to load saved public trips'
  );
}

export async function getForYouPublicTrips(token: string, limit = 20) {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', String(limit));

  const response = await fetch(
    `${API_BASE_URL}/public-trips/for-you?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return parseApiResponse<ForYouTripsResponse>(
    response,
    'Failed to load personalized public trips'
  );
}

export async function createSavedTripCollection(token: string, name: string) {
  const response = await fetch(`${API_BASE_URL}/public-trips/saved/collections`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ name }),
  });

  return parseApiResponse<SavedTripCollectionCreateResponse>(
    response,
    'Failed to create saved trip collection'
  );
}

export async function updateSavedTripCollections(
  token: string,
  savedTripId: string,
  collectionIds: string[]
) {
  const response = await fetch(
    `${API_BASE_URL}/public-trips/saved/${savedTripId}/collections`,
    {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ collectionIds }),
    }
  );

  return parseApiResponse<SavedTripCollectionUpdateResponse>(
    response,
    'Failed to update saved trip collections'
  );
}

export type SavedTripCollectionRenameResponse = {
  collection: SavedTripCollectionSummary;
};

export async function renameSavedTripCollection(
  token: string,
  collectionId: string,
  name: string
) {
  const response = await fetch(
    `${API_BASE_URL}/public-trips/saved/collections/${collectionId}`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name }),
    }
  );
  return parseApiResponse<SavedTripCollectionRenameResponse>(
    response,
    'Failed to rename collection'
  );
}

export async function deleteSavedTripCollection(token: string, collectionId: string) {
  const response = await fetch(
    `${API_BASE_URL}/public-trips/saved/collections/${collectionId}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    }
  );

  return parseApiResponse<SavedTripCollectionDeleteResponse>(
    response,
    'Failed to delete saved trip collection'
  );
}
