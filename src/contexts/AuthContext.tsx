import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { User, UserRole } from '@/types';
import { auth, firebaseEnabled, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  signup: (email: string, password: string, role: UserRole) => Promise<void>;
  loginWithToken: (token: string) => void;
  loginWithGoogle: (role: UserRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo purposes
const mockUsers: Record<UserRole, User> = {
  admin: {
    id: '1',
    name: 'Alex Designer',
    email: 'alex@company.com',
    role: 'admin',
    department: 'Design',
  },
  designer: {
    id: '2',
    name: 'Sarah Creative',
    email: 'sarah@company.com',
    role: 'designer',
    department: 'Design',
  },
  staff: {
    id: '3',
    name: 'John Requester',
    email: 'john@company.com',
    role: 'staff',
    department: 'Marketing',
  },
  treasurer: {
    id: '4',
    name: 'Emily Finance',
    email: 'emily@company.com',
    role: 'treasurer',
    department: 'Finance',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  const decodeTokenUser = (token: string): User | null => {
    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(normalized));
      return {
        id: decoded.sub || '',
        name: decoded.name || decoded.email || 'User',
        email: decoded.email || '',
        role: decoded.role || 'staff',
      } as User;
    } catch {
      return null;
    }
  };

  const persistAuth = (token: string, nextUser: User) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(nextUser));
  };

  useEffect(() => {
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('auth_user');
      }
    }
  }, []);

  useEffect(() => {
    if (!firebaseEnabled || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) return;
      const role = (localStorage.getItem('auth_role') as UserRole) || 'staff';
      const nextUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        email: firebaseUser.email || '',
        role,
      };
      setUser(nextUser);
      localStorage.setItem('auth_user', JSON.stringify(nextUser));
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, role: UserRole) => {
    if (firebaseEnabled && auth) {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem('auth_role', role);
      return;
    }
    if (apiUrl) {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        const data = await response.json();
        const nextUser = data.user as User;
        setUser(nextUser);
        if (data.token) {
          persistAuth(data.token, nextUser);
        }
        return;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    setUser(mockUsers[role]);
  };

  const signup = async (email: string, password: string, role: UserRole) => {
    if (firebaseEnabled && auth) {
      await createUserWithEmailAndPassword(auth, email, password);
      localStorage.setItem('auth_role', role);
      return;
    }
    if (!apiUrl) {
      setUser(mockUsers[role]);
      return;
    }
    const response = await fetch(`${apiUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    if (!response.ok) {
      throw new Error('Signup failed');
    }
    const data = await response.json();
    const nextUser = data.user as User;
    setUser(nextUser);
    if (data.token) {
      persistAuth(data.token, nextUser);
    }
  };

  const loginWithToken = (token: string) => {
    const nextUser = decodeTokenUser(token);
    if (!nextUser) return;
    setUser(nextUser);
    persistAuth(token, nextUser);
  };

  const loginWithGoogle = async (role: UserRole) => {
    if (!firebaseEnabled || !auth || !googleProvider) {
      throw new Error('Google login not configured');
    }
    localStorage.setItem('auth_role', role);
    await signInWithPopup(auth, googleProvider);
  };

  const logout = () => {
    if (firebaseEnabled && auth) {
      signOut(auth);
    }
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  };

  const switchRole = (role: UserRole) => {
    setUser(mockUsers[role]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        signup,
        loginWithToken,
        loginWithGoogle,
        logout,
        switchRole,
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
