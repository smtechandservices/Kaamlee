'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { currentNext } from '@/lib/redirect';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  linkedin_url?: string;
  resume?: string;
  resume_text?: string;
  has_resume?: boolean;
  resume_ai_parsed?: boolean;
  is_subscribed: boolean;
  subscription_expires_at: string | null;
  is_superuser?: boolean;
  is_staff?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedToken = sessionStorage.getItem('kaamlee_token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
        headers: {
          'Authorization': `Token ${authToken}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token might be invalid
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (newToken: string) => {
    sessionStorage.setItem('kaamlee_token', newToken);
    setToken(newToken);
    fetchUser(newToken);
    // Back to the page that sent them to log in (?next=), else the dashboard.
    router.push(currentNext() || '/dashboard');
  };

  const logout = () => {
    // Delete the token on the server too, so a copy of it stops working now
    // rather than lingering until it expires. Fire-and-forget: the local
    // logout below happens regardless (keepalive lets it finish mid-navigation).
    const current = sessionStorage.getItem('kaamlee_token');
    if (current) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/logout/`, {
        method: 'POST',
        headers: { Authorization: `Token ${current}` },
        keepalive: true,
      }).catch(() => {});
    }
    sessionStorage.removeItem('kaamlee_token');
    setToken(null);
    setUser(null);
    router.push('/');
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUser(token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
