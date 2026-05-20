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

export type CreatorFollowState = {
  creator: {
    id: string;
    displayName: string | null;
    isFollowedByMe: boolean;
    followerCount: number;
  };
};

export type PublicUserProfile = {
  id: string;
  displayName: string | null;
  followerCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
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

export async function getUserProfile(userId: string, token?: string | null) {
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'GET',
    headers,
  });

  return parseApiResponse<PublicUserProfile>(response, 'Failed to load user profile');
}

export async function followUser(userId: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/follow`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<CreatorFollowState>(response, 'Failed to follow creator');
}

export async function unfollowUser(userId: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/follow`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  return parseApiResponse<CreatorFollowState>(response, 'Failed to unfollow creator');
}
