"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

let cachedUsers: UserInfo[] | null = null;
let loadingPromise: Promise<UserInfo[]> | null = null;

async function fetchUsers(): Promise<UserInfo[]> {
  if (cachedUsers) return cachedUsers;
  if (loadingPromise) return loadingPromise;

  loadingPromise = api
    .get<{ users: UserInfo[] }>("/api/auth/users")
    .then((data) => {
      cachedUsers = data?.users || [];
      loadingPromise = null;
      return cachedUsers;
    })
    .catch(() => {
      loadingPromise = null;
      return [];
    });

  return loadingPromise;
}

export function useUsers() {
  const [users, setUsers] = useState<UserInfo[]>(cachedUsers || []);
  const [loading, setLoading] = useState(!cachedUsers);

  useEffect(() => {
    fetchUsers().then((data) => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  const getUserName = useCallback(
    (userId: string | null | undefined): string => {
      if (!userId) return "Не назначен";
      const user = users.find((u) => u.id === userId);
      return user?.name || "Пользователь";
    },
    [users]
  );

  const getUserEmail = useCallback(
    (userId: string | null | undefined): string => {
      if (!userId) return "";
      const user = users.find((u) => u.id === userId);
      return user?.email || "";
    },
    [users]
  );

  return { users, loading, getUserName, getUserEmail };
}
