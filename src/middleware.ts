import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // TODO: Replace 'auth-token' with your actual session/cookie name
  // (e.g., 'next-auth.session-token' if using NextAuth, or 'sb-access-token' for Supabase)
  const authToken = request.cookies.get("auth-token")?.value;

  // If no token is found, redirect to the login page
  if (!authToken) {
    const loginUrl = new URL("/", request.url);

    // Save the page they tried to visit so you can redirect them back after login
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - / (the login page itself — prevents infinite redirect)
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt)(?!$).*)",
  ],
};
