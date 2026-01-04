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
  loginWithGoogle: (role: UserRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

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
    if (!firebaseEnabled || !auth) {
      throw new Error('Firebase authentication is not configured');
    }
    localStorage.setItem('auth_role', role);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string, role: UserRole) => {
    if (!firebaseEnabled || !auth) {
      throw new Error('Firebase authentication is not configured');
    }
    localStorage.setItem('auth_role', role);
    await createUserWithEmailAndPassword(auth, email, password);
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
    localStorage.removeItem('auth_role');
  };

  const switchRole = (role: UserRole) => {
    localStorage.setItem('auth_role', role);
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, role };
      localStorage.setItem('auth_user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, ...updates };
      localStorage.setItem('auth_user', JSON.stringify(nextUser));
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
