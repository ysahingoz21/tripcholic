import { API_BASE_URL } from '../constants/api';
import type { AuthUser } from './auth';

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

export type FollowListItem = {
  id: string;
  displayName: string | null;
  avatarUrl?: string | null;
  isFollowedByMe: boolean;
};

export type UserSearchResult = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  isFollowedByMe: boolean;
};

export type PublicUserProfile = {
  id: string;
  displayName: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  followerCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
};

export type UpdateProfilePayload = {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  travelVibes?: string[];
  favoriteCategories?: string[];
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

export async function getUserFollowers(
  userId: string,
  token?: string | null,
): Promise<FollowListItem[]> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}/users/${userId}/followers`, {
    method: 'GET',
    headers,
  });
  return parseApiResponse<FollowListItem[]>(response, 'Failed to load followers');
}

export async function getUserFollowing(
  userId: string,
  token?: string | null,
): Promise<FollowListItem[]> {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}/users/${userId}/following`, {
    method: 'GET',
    headers,
  });
  return parseApiResponse<FollowListItem[]>(response, 'Failed to load following list');
}

export async function removeFollower(
  myUserId: string,
  followerUserId: string,
  token: string,
): Promise<{ followerCount: number }> {
  const response = await fetch(
    `${API_BASE_URL}/users/${myUserId}/followers/${followerUserId}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    },
  );
  return parseApiResponse<{ followerCount: number }>(response, 'Failed to remove follower');
}

export async function searchUsers(
  q: string,
  token?: string | null,
): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ q });
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const response = await fetch(`${API_BASE_URL}/users/search?${params.toString()}`, {
    method: 'GET',
    headers,
  });
  return parseApiResponse<UserSearchResult[]>(response, 'Failed to search travelers');
}

export async function updateProfile(
  token: string,
  payload: UpdateProfilePayload,
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return parseApiResponse<AuthUser>(response, 'Failed to update profile');
}
