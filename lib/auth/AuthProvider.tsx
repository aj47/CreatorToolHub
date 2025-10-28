"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  email: string;
  name: string;
  picture: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single session check on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      setError(null);
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          setUser({
            email: data.user.email,
            name: data.user.name || '',
            picture: data.user.picture || '',
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
        if (response.status !== 401) {
          setError('Failed to check authentication status');
        }
      }
    } catch (err) {
      setUser(null);
      setError('Network error during authentication check');
    } finally {
      setLoading(false);
    }
  };

  const signIn = () => {
    window.location.href = '/api/auth/signin';
  };

  const signOut = async () => {
    try {
      setError(null);
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        setUser(null);
        // Redirect to home page after successful sign out
        window.location.href = '/';
      } else {
        setError('Failed to sign out');
      }
    } catch (err) {
      setError('Network error during sign out');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    checkSession,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
