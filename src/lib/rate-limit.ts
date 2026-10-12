import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

export type RateLimitResult = { allowed: boolean };

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

class SupabaseRpcRateLimiter implements RateLimiter {
  constructor(
    private readonly limit: number,
    private readonly windowSeconds: number,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: key,
      p_limit: this.limit,
      p_window_seconds: this.windowSeconds,
    });

    if (error) throw new Error(`Rate limit RPC failed: ${error.message}`);
    if (typeof data !== "boolean") throw new Error("Rate limit RPC returned an invalid response.");

    return { allowed: data };
  }
}

export function createRateLimiter(limit = 5, windowSeconds = 10 * 60): RateLimiter {
  return new SupabaseRpcRateLimiter(limit, windowSeconds);
}

export function rateLimit(key: string, limit = 5, windowSeconds = 600, backend: RateLimiter = createRateLimiter(limit, windowSeconds)) {
  return backend.check(key);
}

export function rateLimitKey(request: Request, route: string) {
  // Vercel overwrites x-forwarded-for. Other deployments must use a trusted proxy.
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${route}:${createHash("sha256").update(address).digest("hex")}`;
}
