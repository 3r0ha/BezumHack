"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api";

interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  mutate: () => void;
}

export function useApi<T>(url: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!url);
  const urlRef = useRef(url);

  const fetchData = useCallback(async () => {
    if (!urlRef.current) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.get<T>(urlRef.current);
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    urlRef.current = url;

    if (!url) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchData();
  }, [url, fetchData]);

  const mutate = useCallback(() => {
    if (urlRef.current) {
      fetchData();
    }
  }, [fetchData]);

  return { data, error, isLoading, mutate };
}
