import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/server/api-error";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  // Next may use an internal hostname in request.url behind its server/proxy.
  if (request.headers.get("origin") !== `${protocol}://${host}`) {
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
