import { transitionBooking } from "@/lib/server/booking-status";
import { NextResponse } from "next/server";
import { adminBookingStatusSchema } from "@/lib/schemas";
import { authorizeAdmin } from "@/lib/server/admin";
import { apiError } from "@/lib/server/api-error";

export async function GET() {
  const auth = await authorizeAdmin();
  if (auth.status !== 200)
    return apiError(
      auth.status === 401 ? "error.unauthorized" : "error.forbidden",
      auth.status,
    );
  const { data, error } = await auth.supabase
    .from("bookings")
    .select("id,name,phone,date,time,guests,comment,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return apiError("error.generic", 503);
  return NextResponse.json({ data });
}
export async function PATCH(request: Request) {
  const auth = await authorizeAdmin();
  if (auth.status !== 200)
    return apiError(
      auth.status === 401 ? "error.unauthorized" : "error.forbidden",
      auth.status,
    );
  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("validation.invalid", 400);
  }
  const parsed = adminBookingStatusSchema.safeParse(body);
  if (!parsed.success) return apiError("validation.invalid", 400);
  try {
    const result = await transitionBooking(auth.supabase, {
      id: parsed.data.id,
      status: parsed.data.status,
      expected: parsed.data.expected_status ?? "pending",
      actor: auth.user.id,
      source: "web",
    });
    if (result.outcome === "not_found") return apiError("error.notFound", 404);
    if (result.outcome === "conflict")
      return apiError("error.bookingConflict", 409);
    if (result.outcome === "past") return apiError("error.bookingPast", 409);
    return NextResponse.json({ data: result.booking });
  } catch {
    return apiError("error.generic", 503);
  }
}
