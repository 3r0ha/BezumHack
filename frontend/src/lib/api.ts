const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestInterceptor = (config: RequestInit & { url: string }) => RequestInit & { url: string };
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];

export function addRequestInterceptor(interceptor: RequestInterceptor) {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index > -1) requestInterceptors.splice(index, 1);
  };
}

export function addResponseInterceptor(interceptor: ResponseInterceptor) {
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index > -1) responseInterceptors.splice(index, 1);
  };
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string>;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions & { body?: any } = {}
): Promise<T> {
  const { params, ...init } = options;

  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Build headers with automatic token injection
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> || {}),
  };

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let config: RequestInit & { url: string } = {
    ...init,
    headers,
    url,
  };

  // Run request interceptors
  for (const interceptor of requestInterceptors) {
    config = interceptor(config);
  }

  const { url: finalUrl, ...fetchInit } = config;

  let response = await fetch(finalUrl, fetchInit);

  // Run response interceptors
  for (const interceptor of responseInterceptors) {
    response = await interceptor(response);
  }

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    let details: any = undefined;

    try {
      const errorBody = await response.json();
      errorMessage = errorBody.detail || errorBody.message || errorBody.error || errorMessage;
      details = errorBody;
    } catch {
      // Response body is not JSON, keep default message
    }

    throw new ApiError(response.status, errorMessage, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get<T = unknown>(endpoint: string, options?: RequestOptions) {
    return request<T>(endpoint, { ...options, method: "GET" });
  },

  post<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = unknown>(endpoint: string, options?: RequestOptions) {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },
};
