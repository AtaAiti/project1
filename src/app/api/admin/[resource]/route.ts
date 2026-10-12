import { NextResponse } from "next/server";
import { hasAdminIdentityConfig, isAdminUser } from "@/lib/admin-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const resources = new Set(["menu_items", "events", "gallery_photos", "reviews"]);
async function authorized() {
  if (!hasAdminIdentityConfig()) {
    console.error("[admin] Access denied: neither ADMIN_USER_ID nor ADMIN_EMAIL is configured.");
    return { status: 403 as const };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[admin] Access denied: Supabase credentials are not configured.");
    return { status: 403 as const };
  }

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { status: 401 as const };
  if (!isAdminUser(user)) return { status: 403 as const };

  return { status: 200 as const, supabase: createAdminClient() };
}

function validResource(resource: string) {
  return resources.has(resource);
}

function denied(status: 401 | 403) {
  return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  if (!validResource(resource)) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorized();
  if (auth.status !== 200) return denied(auth.status);
  const { data, error } = await auth.supabase.from(resource).select("*").order("created_at", { ascending: false });
  return NextResponse.json({ data, error: error?.message }, { status: error ? 400 : 200 });
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  if (!validResource(resource)) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorized();
  if (auth.status !== 200) return denied(auth.status);
  const { data, error } = await auth.supabase.from(resource).insert(await request.json()).select().single();
  return NextResponse.json({ data, error: error?.message }, { status: error ? 400 : 200 });
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  if (!validResource(resource)) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorized();
  if (auth.status !== 200) return denied(auth.status);
  const { id, ...values } = await request.json();
  const { data, error } = await auth.supabase.from(resource).update(values).eq("id", id).select().single();
  return NextResponse.json({ data, error: error?.message }, { status: error ? 400 : 200 });
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  if (!validResource(resource)) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const auth = await authorized();
  if (auth.status !== 200) return denied(auth.status);
  const { id } = await request.json();
  const { error } = await auth.supabase.from(resource).delete().eq("id", id);
  return NextResponse.json({ ok: !error, error: error?.message }, { status: error ? 400 : 200 });
}
