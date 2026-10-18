import { NextResponse } from "next/server";
import type { BookingErrorKey } from "@/lib/booking-errors";
import { validateBookingInput } from "@/lib/booking-validation";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyHoneypot } from "@/lib/honeypot";
import { sendTelegram } from "@/lib/server/telegram";
import { getDictionary } from "@/lib/dictionaries";
import { findVenueTable } from "@/lib/venue-tables";

export const runtime = "nodejs";

function errorResponse(errorKey: BookingErrorKey, status: number) {
  return NextResponse.json({ errorKey }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("validation.required", 400);
  }

  if (!verifyHoneypot(body)) return NextResponse.json({ ok: true });
  const validation = validateBookingInput(body);
  if (validation.errorKey) return errorResponse(validation.errorKey, 400);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[booking] Request denied: Supabase server credentials are not configured.");
    return errorResponse("error.generic", 503);
  }

  try {
    const { allowed } = await rateLimit(rateLimitKey(request, "booking"), 5, 600);
    if (!allowed) return errorResponse("error.rateLimited", 429);

    const { name, phone, date, time, guests, table_id } = validation.data;
    const table = findVenueTable(table_id);
    const labels = getDictionary("ru").tables;
    // Keep the requested table in the existing, admin-visible booking comment.
    // This is a seating preference, not an inventory hold or confirmed reservation.
    const comment = table
      ? `${labels.requestLabel} ${table.id} (${labels.capacityLabel}: ${table.seats}, ${labels.zones[table.zone]})\n${validation.data.comment}`.trim()
      : validation.data.comment;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("bookings")
      .insert({ name, phone, date, time, guests, comment, status: "pending" })
      .select("id")
      .single();

    if (error) throw new Error(`Booking insert failed: ${error.message}`);

    const notification = getDictionary("ru").telegram;
    await sendTelegram(`${notification.newBooking} ${data.id}\n${name}, ${phone}\n${date} ${time} (${notification.timeZone}), ${notification.guests}: ${guests}\n${comment}`);

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    console.error("[booking] Submission failed.", error);
    return errorResponse("error.generic", 500);
  }
}
