/**
 * Secure API Client
 *
 * This implementation:
 * - Uses credentials: 'include' to automatically send HttpOnly cookies
 * - Never exposes tokens in JavaScript
 * - Handles token refresh transparently
 * - Implements proper error handling
 */

import { logger } from "../lib/logger";

// Global error handler reference
let globalErrorHandler: ((error: unknown) => void) | null = null;

type AuthHandlers = {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<void>;
};

function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("user");
  document.cookie =
    "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie =
    "refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

function getClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(^|;\\s*)" + name + "=([^;]+)"),
  );
  return match ? match[2] : null;
}

const defaultAuthHandlers: AuthHandlers = {
  refreshAccessToken: async () => {
    if (typeof window === "undefined") return false;
    try {
      const refreshToken = getClientCookie("refresh_token");
      const res = await fetch("/api/proxy/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(refreshToken ? { Authorization: `Bearer ${refreshToken}` } : {}),
        },
        body: JSON.stringify({ refreshToken }),
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.data?.access_token) {
        const isSecure = window.location.protocol === "https:";
        const secureFlag = isSecure ? "; Secure" : "";
        document.cookie = `access_token=${data.data.access_token}; path=/; SameSite=Lax${secureFlag}`;
        if (data.data.refresh_token) {
          document.cookie = `refresh_token=${data.data.refresh_token}; path=/; SameSite=Lax${secureFlag}`;
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
  logout: async () => {
    clearAuthSession();
  },
};

let authHandlers: AuthHandlers = defaultAuthHandlers;

// Flag to prevent concurrent refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let isRedirectingToLogin = false;
const LANGUAGE_STORAGE_KEY = "portal-language";

function getRequestLanguage(): string {
  if (typeof document !== "undefined") {
    const documentLanguage = document.documentElement.lang?.trim();
    if (documentLanguage) return documentLanguage;
  }

  if (typeof window !== "undefined") {
    const storedLanguage = window.localStorage
      .getItem(LANGUAGE_STORAGE_KEY)
      ?.trim();
    if (storedLanguage) return storedLanguage;

    const browserLanguage = window.navigator.language?.trim();
    if (browserLanguage) return browserLanguage;
  }

  return "en";
}

// function withLanguageHeaders(headers?: HeadersInit): Headers {
//   const nextHeaders = new Headers(headers)
//   const language = getRequestLanguage()

//   if (!nextHeaders.has('Accept-Language')) {
//     nextHeaders.set('Accept-Language', language)
//   }

//   if (!nextHeaders.has('X-Language')) {
//     nextHeaders.set('X-Language', language)
//   }

//   return nextHeaders
// }

async function withDefaultHeaders(headers?: HeadersInit): Promise<Headers> {
  const nextHeaders = new Headers(headers);
  const language = getRequestLanguage();
  const user = localStorage.getItem("user");
  const userData = user ? JSON.parse(user) : null;
  const userId = userData?.id;
  const cacheKey = "current_app_" + userId;
  let appId: string | null = null;

  if (typeof window !== "undefined") {
    appId = localStorage.getItem(cacheKey);
    // logger.info(
    //   `[withDefaultHeaders] Checking localStorage "${cacheKey}": appIdFound=${appId ?? 'null'}`
    // )
  } else {
    logger.info("[withDefaultHeaders] Skipping localStorage on server-side.");
  }

  // --- SET HEADERS ---
  if (appId && !nextHeaders.has("X-App-Id")) {
    nextHeaders.set("X-App-Id", appId);
    // logger.info(`[withDefaultHeaders] Attached header -> X-App-Id: "${appId}"`)
  } else if (nextHeaders.has("X-App-Id")) {
    logger.info(
      `[withDefaultHeaders] X-App-Id already specified: "${nextHeaders.get("X-App-Id")}"`,
    );
  } else {
    logger.info("[withDefaultHeaders] No X-App-Id resolved.");
  }

  if (!nextHeaders.has("Accept-Language"))
    nextHeaders.set("Accept-Language", language);
  if (!nextHeaders.has("X-Language")) nextHeaders.set("X-Language", language);

  return nextHeaders;
}

function redirectToLoginOnce(reason: string) {
  if (typeof window === "undefined") return;
  if (isRedirectingToLogin) return;

  const currentPath = window.location.pathname;
  if (currentPath === "/login") return;

  isRedirectingToLogin = true;
  clearAuthSession();
  window.location.replace(`/login?reason=${encodeURIComponent(reason)}`);
}

export function setGlobalErrorHandler(handler: (error: unknown) => void) {
  globalErrorHandler = handler;
}

export function setApiAuthHandlers(handlers: Partial<AuthHandlers>) {
  authHandlers = {
    ...authHandlers,
    ...handlers,
  };
}

export type ApiEnvelope<T> = {
  status?: string;
  status_code?: number;
  message?: string;
  data?: T;
};

type ApiRequestOptions = RequestInit & {
  timeout?: number;
  onProgress?: (loaded: number, total: number) => void;
  retryCount?: number;
  next?: { revalidate?: number | false; tags?: string[] };
  skipAuthRefresh?: boolean;
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

function jsonOpts(method: HttpMethod, body?: unknown): RequestInit {
  const opts: RequestInit = { method };

  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }

  return opts;
}

export class ApiError extends Error {
  status?: string;
  statusCode?: number;
  data?: unknown;
  response?: Response | null;
  isGlobal?: boolean;

  constructor(
    message: string,
    opts?: {
      status?: string;
      statusCode?: number;
      data?: unknown;
      response?: Response | null;
      isGlobal?: boolean;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts?.status;
    this.statusCode = opts?.statusCode;
    this.data = opts?.data;
    this.response = opts?.response ?? null;
    this.isGlobal = opts?.isGlobal ?? false;
  }
}

export class AuthenticationError extends ApiError {
  constructor(
    message: string = "Your session has expired. Please log in again.",
  ) {
    // Pass isGlobal: true so components know the client is handling the lifecycle redirect
    super(message, { statusCode: 401, isGlobal: true });
    this.name = "AuthenticationError";
  }
}

export class NetworkError extends ApiError {
  constructor(message: string, statusCode: number = 0) {
    // Gateway drops are infrastructure/global issues by default
    super(message, { statusCode, isGlobal: true });
    this.name = "NetworkError";
  }
}

function isConnectionRefusedMessage(message?: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("econnrefused") ||
    normalized.includes("connection refused") ||
    normalized.includes("failed to connect") ||
    normalized.includes("connect refused")
  );
}

function getFriendlyHttpErrorMessage(
  status: number,
  message?: string | null,
): string | null {
  if (isConnectionRefusedMessage(message)) {
    return "Cannot connect to backend. The service may be offline.";
  }

  if (status === 502 || status === 503 || status === 504) {
    return "Cannot connect to backend. The service may be offline.";
  }
  return null;
}

async function safeParseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T = unknown>(
  url: string,
  options?: ApiRequestOptions,
): Promise<ApiEnvelope<T>> {
  const {
    onProgress,
    retryCount = 0,
    timeout = 15000,
    skipAuthRefresh = false,
    ...fetchOptions
  } = options || {};

  const finalUrl = url;

  // Security Guardrail: Enforce proxy routing on client execution
  if (typeof window !== "undefined" && /^https?:\/\//i.test(url)) {
    throw new ApiError("Use internal API routes only (e.g. /api/proxy/...).");
  }

  const secureOptions: RequestInit = {
    ...fetchOptions,
    credentials: "include", // Ensures HttpOnly cookies are automatically transported
    headers: await withDefaultHeaders(fetchOptions?.headers),
  };

  // --- XHR UPLOAD PROGRESS INTERCEPTOR ---
  if (onProgress) {
    const headers = await withDefaultHeaders(fetchOptions?.headers);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(fetchOptions.method || "GET", finalUrl);

      // Apply credentials and headers to XHR request
      xhr.withCredentials = true;
      headers.forEach((value, key) => {
        xhr.setRequestHeader(key, value);
      });

      if (xhr.upload) {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            onProgress(event.loaded, event.total);
          }
        });
      }

      xhr.addEventListener("load", async () => {
        try {
          const responseText = xhr.responseText;
          const parsed = JSON.parse(responseText) as ApiEnvelope<T>;

          const isEnvelope401 =
            parsed && typeof parsed === "object" && parsed.status_code === 401;
          const isHttp401 = xhr.status === 401;

          // Handle XHR 401 Authorization refresh triggers
          if (
            !skipAuthRefresh &&
            (isHttp401 || isEnvelope401) &&
            retryCount < 5
          ) {
            logger.log("🚨 XHR 401 Unauthorized - attempting token refresh");
            if (isRefreshing) {
              await refreshPromise;
            } else {
              isRefreshing = true;
              refreshPromise = authHandlers.refreshAccessToken();
              const refreshed = await refreshPromise;
              isRefreshing = false;
              refreshPromise = null;

              if (!refreshed) {
                await authHandlers.logout();
                if (typeof window !== "undefined") {
                  localStorage.removeItem("user");
                  redirectToLoginOnce("session_expired");
                }
                reject(new AuthenticationError());
                return;
              }
            }

            try {
              const retryResult = await apiRequest<T>(url, {
                ...options,
                retryCount: retryCount + 1,
              });
              resolve(retryResult);
            } catch (retryErr) {
              reject(retryErr);
            }
            return;
          }

          const isSuccess =
            xhr.status >= 200 &&
            xhr.status < 300 &&
            (!parsed.status_code ||
              (parsed.status_code >= 200 && parsed.status_code < 300));

          if (isSuccess) {
            resolve(parsed);
          } else {
            reject(
              new ApiError(parsed?.message || "Request failed", {
                status: parsed?.status,
                statusCode: parsed?.status_code ?? xhr.status,
                data: parsed?.data,
              }),
            );
          }
        } catch {
          reject(new ApiError("Failed to parse response payload"));
        }
      });

      xhr.addEventListener("error", () => {
        reject(
          new NetworkError("Network request failed during progress stream."),
        );
      });

      if (fetchOptions.body) {
        xhr.send(fetchOptions.body as XMLHttpRequestBodyInit);
      } else {
        xhr.send();
      }
    });
  }

  // --- CORE FETCH CLIENT INTERCEPTOR ---
  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    response = await fetch(finalUrl, {
      ...secureOptions,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutError = new ApiError("Request timeout - API took too long", {
        statusCode: 408,
      });
      if (globalErrorHandler) globalErrorHandler(timeoutError);
      throw timeoutError;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (
      err instanceof TypeError ||
      message.toLowerCase().includes("failed to fetch") ||
      message.includes("ECONNREFUSED")
    ) {
      const networkError = new NetworkError(
        "Cannot connect to server. The backend service may be offline.",
      );
      if (globalErrorHandler) globalErrorHandler(networkError);
      throw networkError;
    }
    throw new ApiError(message);
  } finally {
    clearTimeout(timeoutId);
  }

  // Intercept Strategy A: Raw Network HTTP 401 Status Header
  if (!skipAuthRefresh && response.status === 401 && retryCount < 3) {
    logger.log("🚨 HTTP 401 Unauthorized - attempting token refresh");
    if (isRefreshing) {
      await refreshPromise;
    } else {
      isRefreshing = true;
      refreshPromise = authHandlers.refreshAccessToken();
      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;

      if (!refreshed) {
        await authHandlers.logout();
        if (typeof window !== "undefined") {
          localStorage.removeItem("user");
          redirectToLoginOnce("session_expired");
        }
        throw new AuthenticationError();
      }
    }
    logger.log("✅ Token refreshed, retrying request");
    return apiRequest<T>(url, { ...options, retryCount: retryCount + 1 });
  }

  const data = await safeParseJson(response);

  if (data && typeof data === "object" && "status" in data) {
    const envelope = data as ApiEnvelope<T>;

    // ✨ FIX: Intercept Strategy B (Envelope 401 Status Code) BEFORE evaluating general failures
    if (!skipAuthRefresh && envelope.status_code === 401 && retryCount < 3) {
      logger.log("🚨 Envelope 401 Unauthorized - attempting token refresh");
      if (isRefreshing) {
        await refreshPromise;
      } else {
        isRefreshing = true;
        refreshPromise = authHandlers.refreshAccessToken();
        const refreshed = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;

        if (!refreshed) {
          await authHandlers.logout();
          if (typeof window !== "undefined") {
            localStorage.removeItem("user");
            redirectToLoginOnce("session_expired");
          }
          throw new AuthenticationError();
        }
      }
      logger.log("✅ Token refreshed, retrying request");
      return apiRequest<T>(url, { ...options, retryCount: retryCount + 1 });
    }

    // Evaluate general endpoint data ranges
    const isSuccess =
      envelope.status_code &&
      envelope.status_code >= 200 &&
      envelope.status_code < 300;
    if (!isSuccess) {
      const code = envelope.status_code ?? response.status;
      const friendlyMessage = getFriendlyHttpErrorMessage(
        code,
        envelope.message,
      );

      // Keep throwing infrastructure drops (502, 503, 504) since they don't have valid app envelopes
      if (friendlyMessage && [502, 503, 504].includes(code)) {
        const error = new NetworkError(friendlyMessage, code);
        if (globalErrorHandler) globalErrorHandler(error);
        throw error;
      }

      // ✨ CHANGE: Return the envelope down to the component instead of throwing it
      return envelope;
    }

    return envelope;
  }

  // Handle fallback standard bad network descriptors
  if (!response.ok) {
    const messageFromBody =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : null;
    const friendlyMessage = getFriendlyHttpErrorMessage(
      response.status,
      messageFromBody,
    );
    if (friendlyMessage) throw new NetworkError(friendlyMessage);
    throw new ApiError(`HTTP ${response.status}: ${response.statusText}`, {
      statusCode: response.status,
      data,
      response,
    });
  }

  return { status: "OK", status_code: response.status, data: data as T };
}

export async function put<T>(
  data: unknown,
  endpoint: string,
  options?: ApiRequestOptions,
) {
  return apiRequest<T>(endpoint, { ...jsonOpts("PUT", data), ...options });
}

export async function get<T>(endpoint: string, options?: ApiRequestOptions) {
  return apiRequest<T>(endpoint, { ...jsonOpts("GET"), ...options });
}

// Simplified Delete helper
export async function del<T>(
  endpoint: string,
  data?: unknown,
  options?: ApiRequestOptions,
) {
  return apiRequest<T>(endpoint, { ...jsonOpts("DELETE", data), ...options });
}

export async function post<T>(
  data: unknown,
  endpoint: string,
  options?: ApiRequestOptions,
) {
  return apiRequest<T>(endpoint, { ...jsonOpts("POST", data), ...options });
}

export async function patch<T>(
  data: unknown,
  endpoint: string,
  options?: ApiRequestOptions,
) {
  return apiRequest<T>(endpoint, { ...jsonOpts("PATCH", data), ...options });
}
