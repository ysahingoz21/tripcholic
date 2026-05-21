import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getMe,
  login as loginRequest,
  register as registerRequest,
  type AuthUser,
} from '@/services/auth';

const AUTH_TOKEN_STORAGE_KEY = 'tripcholic.auth.token';

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthState = async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setUser(null);
    setToken(null);
  };

  const hydrateUserFromToken = async (
    accessToken: string,
    options?: { clearOnFailure?: boolean }
  ) => {
    try {
      const currentUser = await getMe(accessToken);
      setToken(accessToken);
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (options?.clearOnFailure) {
        await clearAuthState();
      }
      throw error;
    }
  };

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

        if (!storedToken) {
          setUser(null);
          setToken(null);
          return;
        }

        await hydrateUserFromToken(storedToken, { clearOnFailure: true });
      } catch {
        await clearAuthState();
      } finally {
        setIsLoading(false);
      }
    }

    void restoreSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    const authResult = await loginRequest(email, password);
    await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authResult.accessToken);
    setToken(authResult.accessToken);
    setUser(authResult.user);
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string
  ) => {
    await registerRequest(email, password, displayName);
    await signIn(email, password);
  };

  const signOut = async () => {
    await clearAuthState();
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const currentUser = await getMe(token);
      setUser(currentUser);
    } catch { /* silent — stale data is better than crashing */ }
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      signIn,
      signUp,
      signOut,
      refreshUser,
      setUser,
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
