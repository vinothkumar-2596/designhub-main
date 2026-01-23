import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { API_URL } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  signup: (email: string, password: string, role: UserRole) => Promise<void>;
  loginWithGoogle: (role: UserRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_KEY = 'auth_user';
const ROLE_KEY = 'auth_role';
const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        localStorage.removeItem(USER_KEY);
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (!token || !API_URL) return;

    localStorage.setItem(TOKEN_KEY, token);
    url.searchParams.delete('token');
    url.searchParams.delete('provider');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load user');
        const data = await response.json();
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      });
  }, []);

  const login = async (email: string, password: string, role: UserRole) => {
    if (!API_URL) {
      throw new Error('API URL is not configured');
    }
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    if (!response.ok) {
      throw new Error('Login failed');
    }
    const data = await response.json();
    if (data?.token && data?.user) {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(ROLE_KEY, role);
      setUser(data.user);
    }
  };

  const signup = async (email: string, password: string, role: UserRole) => {
    if (!API_URL) {
      throw new Error('API URL is not configured');
    }
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    if (!response.ok) {
      throw new Error('Signup failed');
    }
    const data = await response.json();
    if (data?.token && data?.user) {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(ROLE_KEY, role);
      setUser(data.user);
    }
  };

  const loginWithGoogle = async (role: UserRole) => {
    if (!API_URL) {
      throw new Error('API URL is not configured');
    }
    const response = await fetch(`${API_URL}/api/auth/google/start?role=${role}`);
    if (!response.ok) {
      throw new Error('Google login not configured');
    }
    const data = await response.json();
    if (!data?.url) {
      throw new Error('Google login not configured');
    }
    localStorage.setItem(ROLE_KEY, role);
    window.location.href = data.url;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  const switchRole = (role: UserRole) => {
    localStorage.setItem(ROLE_KEY, role);
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, role };
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        signup,
        loginWithGoogle,
        logout,
        switchRole,
        updateUser,
      }}
    >
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
