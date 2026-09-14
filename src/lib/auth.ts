import { cookies } from "next/headers";
import { UserEntity } from "../services/auth/auth.types";
import { logger } from "./logger";

export type AuthTokenPayload = {
  role?: string;
  exp?: number;
  sub?: string;
  email?: string;
  [key: string]: unknown;
};

type CookieBag = {
  get: (name: string) => { value: string } | undefined;
  getAll?: () => Array<{ name: string; value: string }>;
};

const ACCESS_TOKEN_COOKIE_NAMES = [
  "access_token",
  "accessToken",
  "auth_token",
  "token",
  "jwt",
] as const;

function normalizeToken(rawToken?: string | null): string | null {
  if (!rawToken) return null;
  const token = rawToken.trim();
  if (!token) return null;

  if (/^bearer\s+/i.test(token)) {
    return token.replace(/^bearer\s+/i, "").trim();
  }

  return token;
}

function isJwtLike(token: string): boolean {
  return token.split(".").length === 3;
}

function decodeBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8");
    }
    if (typeof atob !== "undefined") {
      return atob(padded);
    }
    return null;
  } catch {
    return null;
  }
}

export function decodeAuthToken(token: string): AuthTokenPayload | null {
  try {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) return null;

    const parts = normalizedToken.split(".");
    if (parts.length !== 3) return null;

    const decoded = decodeBase64Url(parts[1]);
    if (!decoded) return null;

    return JSON.parse(decoded) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(exp?: number): boolean {
  if (!exp) return true;
  return Date.now() >= exp * 1000;
}

export function isRawTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeAuthToken(token);
  return !payload || isTokenExpired(payload.exp);
}

export function isValidAccessToken(token?: string | null): boolean {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) return false;

  if (!isJwtLike(normalizedToken)) return true;

  const payload = decodeAuthToken(normalizedToken);
  if (!payload) return false;
  return !isTokenExpired(payload.exp);
}

export function getAccessTokenFromCookies(cookieBag: CookieBag): string | null {
  for (const name of ACCESS_TOKEN_COOKIE_NAMES) {
    const value = normalizeToken(cookieBag.get(name)?.value);
    if (value) return value;
  }

  const allCookies = cookieBag.getAll?.() ?? [];
  for (const cookie of allCookies) {
    const value = normalizeToken(cookie.value);
    if (value && isJwtLike(value)) return value;
  }

  return null;
}

/**
 * SERVER SIDE: Safely retrieves and parses the user profile from HttpOnly cookies.
 */
export async function getServerProfile(): Promise<UserEntity | null> {
  try {
    const cookieStore = await cookies();
    const profileCookie = cookieStore.get("user_profile");

    if (!profileCookie?.value) {
      logger.warn("getServerProfile: No user_profile cookie found.");
      return null;
    }

    const rawData = decodeURIComponent(profileCookie.value);
    return rawData ? (JSON.parse(rawData) as UserEntity) : null;
  } catch (e) {
    logger.error(
      "getServerProfile: Failed to parse user profile from cookies",
      e,
    );
    return null;
  }
}

/**
 * Single-role evaluator helper
 */
export function checkUserRole(
  user: UserEntity | null,
  roleName: string,
): boolean {
  if (!user || !user.role) return false;

  if (typeof user.role === "string") {
    return user.role.toLowerCase() === roleName.toLowerCase();
  }

  return false;
}
