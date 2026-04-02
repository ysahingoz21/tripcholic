import React, { createContext, useContext, useMemo, useState } from 'react';

type User = {
  name: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  signIn: (username: string, password: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const signIn = (username: string, password: string) => {
    setUser({
      name: 'Tuğçe Tepe',
      email: 'tripcholic.user@example.com',
    });
    setToken('demo-token');
  };

  const signOut = () => {
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      signIn,
      signOut,
    }),
    [user, token]
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