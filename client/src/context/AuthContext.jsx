import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { toast } from 'sonner';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res?.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res?.data?.user) {
      setUser(res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      return res.data.user;
    }
  };

  const register = async (userData) => {
    const res = await api.post('/auth/register', userData);
    if (res?.data?.user) {
      setUser(res.data.user);
      toast.success(`Account created! Welcome to IdeaPulse, ${res.data.user.name}.`);
      return res.data.user;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Continue locally even if request fails
    }
    setUser(null);
    toast.info('You have been logged out.');
  };

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
      toast.success('Signed out of all devices.');
    } catch (err) {
      toast.error(err.message || 'Could not sign out other devices.');
      return;
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        logoutAll,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
