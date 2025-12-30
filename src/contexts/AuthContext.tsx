import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
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

  const login = async (email: string, password: string, role: UserRole) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setUser(mockUsers[role]);
  };

  const logout = () => {
    setUser(null);
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
