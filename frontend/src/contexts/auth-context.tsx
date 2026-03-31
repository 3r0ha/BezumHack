"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: "CLIENT" | "DEVELOPER" | "MANAGER";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  const clearAuth = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  // On mount: check localStorage for token, validate via API
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);

    api
      .get<User>("/api/auth/me")
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [clearAuth]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ token: string; user: User }>("/api/auth/login", {
      email,
      password,
    });

    localStorage.setItem("token", response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string, role: string) => {
      const response = await api.post<{ token: string; user: User }>("/api/auth/register", {
        email,
        password,
        name,
        role,
      });

      localStorage.setItem("token", response.token);
      setToken(response.token);
      setUser(response.user);
    },
    []
  );

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
