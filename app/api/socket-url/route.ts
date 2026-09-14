import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.BACKEND_URL || "http://localhost:4000";
  return NextResponse.json({ url });
}
