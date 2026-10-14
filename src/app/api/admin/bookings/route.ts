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
  const { data, error } = await auth.supabase
    .from("bookings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id,name,phone,date,time,guests,comment,status,created_at")
    .single();
  if (error) return apiError("error.generic", 503);
  return NextResponse.json({ data });
}
