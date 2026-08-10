import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { decodeAuthToken, getAccessTokenFromCookies } from "./src/lib/auth";
import { logger } from "./src/lib/logger";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

const PUBLIC_ROUTES = ["/login", "/unauthorized"];
const PUBLIC_API_ROUTES = [
  "/api/proxy/auth/login",
  "/api/proxy/auth/refresh-token",
  "/api/proxy/auth/logout",
  "/api/proxy/auth/register",
];

export async function proxy(request: NextRequest): Promise<Response> {
  const { pathname, search } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/proxy");

  // Allow next static assets through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const accessToken = getAccessTokenFromCookies(request.cookies);
  const payload = accessToken ? decodeAuthToken(accessToken) : null;
  const isExpired =
    payload && payload.exp ? Date.now() >= payload.exp * 1000 : true;

  const isPublicApi = PUBLIC_API_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  // 1. Auth Validation for API routes
  if (isApiRoute && !isPublicApi && (!payload || isExpired)) {
    return new Response(
      JSON.stringify({
        status: "Unauthorized",
        status_code: 401,
        message: "Invalid or expired access token",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. FORWARD API REQUESTS TO BACKEND SERVER
  if (isApiRoute) {
    const backendPath = pathname.replace(/^\/api\/proxy/, "");
    const targetUrl = `${BACKEND_URL}${backendPath}${search}`;

    const headers = new Headers(request.headers);
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await request.blob(),
      });

      return response;
    } catch (error) {
      logger.error("[PROXY] Error connecting to backend server:", error);
      return new Response(
        JSON.stringify({
          status: "Error",
          status_code: 502,
          message: "Unable to connect to backend server",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  return NextResponse.next();
}
