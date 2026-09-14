"use server";

export async function getSocketUrl(): Promise<string> {
  return process.env.BACKEND_URL || "http://localhost:4000";
}
