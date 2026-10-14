import { NextResponse } from "next/server";
import { rsvpSchema } from "@/lib/schemas";
import { verifyHoneypot } from "@/lib/honeypot";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/server/api-error";
import { sendTelegram } from "@/lib/server/telegram";
import { getDictionary } from "@/lib/dictionaries";
import { rsvpRpcError } from "@/lib/rsvp-errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("validation.invalid", 400);
  }
  if (!verifyHoneypot(body))
    return NextResponse.json({ ok: true, seatsLeft: null });
  const parsed = rsvpSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key =
      issue.path[0] === "phone"
        ? "validation.phone"
        : issue.path[0] === "guests"
          ? "validation.guests"
          : issue.message === "validation.required"
            ? "validation.required"
            : "validation.invalid";
    return apiError(key, 400);
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return apiError("error.generic", 503);
  try {
    if (!(await rateLimit(rateLimitKey(request, "rsvp"), 5, 600)).allowed)
      return apiError("error.rateLimited", 429);
    const client = createAdminClient();
    const { event_id, name, phone, guests } = parsed.data;
    const { data, error } = await client.rpc("create_event_rsvp", {
      p_event_id: event_id,
      p_name: name,
      p_phone: phone,
      p_guests: guests,
    });
    if (error) {
      const key = rsvpRpcError(error.message, error.code);
      return apiError(
        key,
        key === "rsvp.notFound" ? 404 : key === "error.generic" ? 503 : 409,
      );
    }
    const row = data?.[0];
    if (!row) return apiError("error.generic", 503);
    try {
      const { data: event } = await client
        .from("events")
        .select("title_ru,date,time")
        .eq("id", event_id)
        .single();
      const d = getDictionary("ru");
      await sendTelegram(
        `${d.rsvp.newRsvp}: ${event?.title_ru || event_id}\n${name}, ${phone}\n${event?.date || ""} ${event?.time || ""} (${d.telegram.timeZone})\n${d.rsvp.guests}: ${guests}\n${d.rsvp.seatsLeft}: ${row.seats_left ?? d.rsvp.unlimited}\n${row.id}`,
      );
    } catch {
      console.error(
        "[rsvp] Notification failed after successful registration.",
      );
    }
    return NextResponse.json({ ok: true, seatsLeft: row.seats_left });
  } catch {
    console.error("[rsvp] Submission failed.");
    return apiError("error.generic", 503);
  }
}
