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

export type AuthUser = {
  id: string;
  displayName: string | null;
  email: string;
  createdAt: string;
  updatedAt?: string;
};

type LoginResponseData = {
  message: string;
  accessToken: string;
  tokenType: string;
  user: AuthUser;
};

type RegisterResponseData = {
  message: string;
  user: AuthUser;
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

  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message;

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

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  return parseApiResponse<LoginResponseData>(response, 'Login failed');
}

export async function register(
  email: string,
  password: string,
  displayName?: string
) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, displayName }),
  });

  return parseApiResponse<RegisterResponseData>(response, 'Register failed');
}

export async function getMe(token: string) {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseApiResponse<AuthUser>(response, 'Failed to fetch user');
}
