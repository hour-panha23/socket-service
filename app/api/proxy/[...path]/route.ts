import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

// Helper function to handle and forward all incoming HTTP requests
async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const pathString = path.join("/");
    const searchParams = request.nextUrl.search;

    // 1. Build hidden target URL to NestJS backend
    const targetUrl = `${BACKEND_URL}/${pathString}${searchParams}`;

    // 2. Clone headers and attach Authorization token from HttpOnly cookie
    const headers = new Headers(request.headers);
    headers.delete("host"); // Remove host header so backend handles domain correctly

    const cookieStore = await cookies();
    const token =
      cookieStore.get("access_token")?.value ||
      cookieStore.get("accessToken")?.value;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // 3. Extract request body for non-GET/HEAD methods
    let body: ReadableStream | null = null;
    if (!["GET", "HEAD"].includes(request.method)) {
      body = request.body;
    }

    // 4. Forward request server-to-server
    const backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      // @ts-expect-error - Required for node-fetch body streaming in Next.js
      duplex: "half",
    });

    // 5. Return response to the frontend client
    const responseHeaders = new Headers(backendResponse.headers);

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("❌ [API PROXY ERROR]:", error);
    return NextResponse.json(
      {
        success: false,
        statusCode: 502,
        message: "Failed to connect to internal API server.",
      },
      { status: 502 },
    );
  }
}

// Export route handlers for all standard HTTP methods
export {
  handleProxy as DELETE,
  handleProxy as GET,
  handleProxy as HEAD,
  handleProxy as OPTIONS,
  handleProxy as PATCH,
  handleProxy as POST,
  handleProxy as PUT,
};
