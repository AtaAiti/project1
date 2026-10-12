import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/server/api-error";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return apiError("error.forbidden", 403);
  }
  try {
    const client = await createClient();
    const { error } = await client.auth.signOut();
    if (error) return apiError("error.generic", 503);
    return NextResponse.json({ ok: true });
  } catch {
    return apiError("error.generic", 503);
  }
}
