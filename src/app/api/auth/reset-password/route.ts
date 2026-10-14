import { NextResponse } from "next/server";
import { adminEmailSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { apiError } from "@/lib/server/api-error";
export async function POST(request: Request) {
  const url = new URL(request.url),
    host = request.headers.get("host") || url.host,
    protocol =
      request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  const origin = `${protocol}://${host}`;
  if (request.headers.get("origin") !== origin)
    return apiError("error.forbidden", 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("validation.email", 400);
  }
  const parsed = adminEmailSchema.safeParse(body);
  if (!parsed.success) return apiError("validation.email", 400);
  try {
    if (
      !(await rateLimit(rateLimitKey(request, "password-reset"), 3, 3600))
        .allowed
    ) {
      const response = apiError("error.emailRateLimited", 429);
      response.headers.set("Retry-After", "3600");
      return response;
    }
    const client = await createClient();
    const { error } = await client.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${origin}/admin/reset-password` },
    );
    if (error) {
      console.error("[auth] Recovery email rejected:", error.code || "unknown");
      return apiError(
        error.status === 429 || error.code === "over_email_send_rate_limit"
          ? "error.emailRateLimited"
          : "error.emailDelivery",
        error.status === 429 ? 429 : 503,
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[auth] Recovery email request failed.");
    return apiError("error.emailDelivery", 503);
  }
}
