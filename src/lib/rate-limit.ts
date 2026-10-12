import { createAdminClient } from "@/lib/supabase/admin";

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

export function rateLimit(key: string, backend: RateLimiter = createRateLimiter()) {
  return backend.check(key);
}
