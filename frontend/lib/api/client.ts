import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import type { ApiError, ApiResponse } from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

const AUTH_SKIP_ROUTES = [
  "/users/login",
  "/users/register",
  "/users/refresh-token"
];

let refreshPromise: Promise<void> | null = null;

function shouldSkipRefresh(url?: string) {
  if (!url) return false;
  return AUTH_SKIP_ROUTES.some((route) => url.includes(route));
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/users/refresh-token")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function normalizeError(error: AxiosError<ApiError>): ApiError {
  if (error.response?.data?.message) {
    return error.response.data;
  }

  return {
    statusCode: error.response?.status ?? 500,
    message: error.message || "Request failed",
    success: false,
    errors: []
  };
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const config = error.config as RetriableConfig | undefined;

    if (status === 401 && config && !config._retry && !shouldSkipRefresh(config.url)) {
      config._retry = true;

      try {
        await refreshAccessToken();
        return api.request(config);
      } catch {
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.get<ApiResponse<T>>(url, config);
  return response.data.data;
}

export async function apiPost<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.post<ApiResponse<T>>(url, data, config);
  return response.data.data;
}

export async function apiPatch<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.patch<ApiResponse<T>>(url, data, config);
  return response.data.data;
}

export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.delete<ApiResponse<T>>(url, config);
  return response.data.data;
}
