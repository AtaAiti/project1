import { NextResponse } from "next/server";
import { z } from "zod";
import { bookingTimeError } from "@/lib/booking-time";
import { availableTableIds } from "@/lib/server/table-availability";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
const query = z.object({ date: z.iso.date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), guests: z.coerce.number().int().min(1).max(20) });
export async function GET(request: Request) {
  const result = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!result.success) return NextResponse.json({ errorKey: "validation.invalid" }, { status: 400 });
  const { date, time, guests } = result.data;
  const errorKey = bookingTimeError(date, time);
  if (errorKey) return NextResponse.json({ errorKey }, { status: 400 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ errorKey: "error.generic" }, { status: 503 });
  try {
    if (!(await rateLimit(rateLimitKey(request, "tables"), 120, 60)).allowed)
      return NextResponse.json({ errorKey: "error.rateLimited" }, { status: 429 });
    return NextResponse.json({ available: await availableTableIds(date, time, guests) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ errorKey: "error.generic" }, { status: 503 });
  }
}
