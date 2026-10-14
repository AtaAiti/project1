import { NextResponse } from "next/server";
import { reviewSubmissionSchema } from "@/lib/schemas";
import { verifyHoneypot } from "@/lib/honeypot";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/server/api-error";
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("validation.invalid", 400);
  }
  if (!verifyHoneypot(body)) return NextResponse.json({ ok: true });
  const parsed = reviewSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return apiError(
      issue.path[0] === "rating"
        ? "validation.rating"
        : issue.message === "validation.required"
          ? "validation.required"
          : "validation.invalid",
      400,
    );
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return apiError("error.generic", 503);
  try {
    if (!(await rateLimit(rateLimitKey(request, "reviews"), 5, 600)).allowed)
      return apiError("error.rateLimited", 429);
    const { author, rating, text } = parsed.data;
    // Keep the author's original text in both locales; moderators may add a translation.
    const { error } = await createAdminClient()
      .from("reviews")
      .insert({
        author,
        rating,
        text_ru: text,
        text_en: text,
        status: "moderation",
      });
    if (error) {
      console.error("[reviews] Submission failed.");
      return apiError("error.generic", 503);
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[reviews] Submission failed.");
    return apiError("error.generic", 503);
  }
}
