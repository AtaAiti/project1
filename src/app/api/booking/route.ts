import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { BookingErrorKey } from "@/lib/booking-errors";
import { validateBookingInput } from "@/lib/booking-validation";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function errorResponse(errorKey: BookingErrorKey, status: number) {
  return NextResponse.json({ errorKey }, { status });
}

function getRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = request.headers.get("x-real-ip")?.trim() || forwardedFor || "unknown";
  return `booking:${createHash("sha256").update(clientAddress).digest("hex")}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("validation.required", 400);
  }

  const validation = validateBookingInput(body);
  if (validation.errorKey) return errorResponse(validation.errorKey, 400);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[booking] Request denied: Supabase server credentials are not configured.");
    return errorResponse("error.generic", 503);
  }

  try {
    const { allowed } = await rateLimit(getRateLimitKey(request));
    if (!allowed) return errorResponse("error.rateLimited", 429);

    const { name, phone, date, time, guests, comment } = validation.data;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("bookings")
      .insert({ name, phone, date, time, guests, comment })
      .select("id")
      .single();

    if (error) throw new Error(`Booking insert failed: ${error.message}`);

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: `Новая бронь ${data.id}\n${name}, ${phone}\n${date} ${time}, гостей: ${guests}\n${comment}` }),
      });
      if (!telegramResponse.ok) throw new Error(`Telegram request failed with status ${telegramResponse.status}.`);
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    console.error("[booking] Submission failed.", error);
    return errorResponse("error.generic", 500);
  }
}
