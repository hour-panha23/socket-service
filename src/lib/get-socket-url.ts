import { getSocketUrl as getSocketUrlAction } from "../actions/get-socket-url";

let cachedUrl: string | null = null;

export async function resolveSocketUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;

  try {
    const url = await getSocketUrlAction();
    if (url) {
      cachedUrl = url;
      return url;
    }
  } catch {
    // In case server action fails or falls back
    try {
      const res = await fetch("/api/socket-url");
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          cachedUrl = data.url;
          return data.url;
        }
      }
    } catch {
      // ignore
    }
  }

  return "http://localhost:4000";
}
