// lib/apiClient.ts
import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  withCredentials: true, // REQUIRED: Transmits HTTP-only cookies on every request
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/refresh")
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        await apiClient.post("/auth/refresh");

        return apiClient(originalRequest);
      } catch (refreshError) {
        if (typeof window !== "undefined") {
          window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname)}`;
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuth?: boolean; // Optional: skip adding headers/cookies for public endpoints
}

// Interface for helper functions passing optional Axios configs
export interface ApiRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
  skipAuth?: boolean;
}

export interface FetchJsonConfig extends AxiosRequestConfig {
  _retry?: boolean;
  skipAuth?: boolean;
}
