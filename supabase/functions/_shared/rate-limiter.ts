import { supabase } from "./supabase.ts";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inMemoryStore) {
    if (entry.resetAt <= now) inMemoryStore.delete(key);
  }
}, CLEANUP_INTERVAL);

export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const windowKey = Math.floor(nowSec / windowSeconds);
  const storeKey = `${identifier}:${windowKey}`;
  const resetAt = (windowKey + 1) * windowSeconds * 1000;

  const existing = inMemoryStore.get(storeKey);
  if (existing && existing.resetAt > now) {
    existing.count++;
    const allowed = existing.count <= maxRequests;
    return { allowed, remaining: Math.max(0, maxRequests - existing.count), resetAt: existing.resetAt };
  }

  inMemoryStore.set(storeKey, { count: 1, resetAt });
  return { allowed: true, remaining: maxRequests - 1, resetAt };
}

export function rateLimitMiddleware(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";
      const identifier = `${url.pathname}:${ip}`;

      const { allowed, remaining, resetAt } = await checkRateLimit(identifier);

      if (!allowed) {
        return new Response(JSON.stringify({
          error: "Too many requests. Please slow down.",
          retryAfter: Math.ceil((resetAt - Date.now()) / 1000)
        }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0"
          }
        });
      }

      const response = await handler(req);

      const headers = new Headers(response.headers);
      headers.set("X-RateLimit-Remaining", String(remaining));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (err) {
      console.error("[RateLimiter] Error:", err);
      return handler(req);
    }
  };
}
