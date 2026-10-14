import { NextResponse } from "next/server";
import { adminResourceSchema, resourceSchemas, adminPatchSchema, adminDeleteSchema, adminListQuerySchema } from "@/lib/schemas";
import { authorizeAdmin } from "@/lib/server/admin";
import { apiError } from "@/lib/server/api-error";

type Context = { params: Promise<{ resource: string }> };

async function contextFor(context: Context) {
  const { resource } = await context.params;
  const parsed = adminResourceSchema.safeParse(resource);
  if (!parsed.success) return { ok: false, response: apiError("error.notFound", 404) } as const;
  const auth = await authorizeAdmin();
  if (auth.status !== 200) return { ok: false, response: apiError(auth.status === 401 ? "error.unauthorized" : "error.forbidden", auth.status) } as const;
  return { ok: true, resource: parsed.data, supabase: auth.supabase } as const;
}

export async function GET(request: Request, context: Context) {
  const ctx = await contextFor(context);
  if (!ctx.ok) return ctx.response;
  const params = new URL(request.url).searchParams;
  const input = Object.fromEntries(params);
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) return apiError("validation.invalid", 400);
  const parsed = adminListQuerySchema.safeParse(input);
  if (!parsed.success || (parsed.data.event_id && ctx.resource !== "event_rsvps")) return apiError("validation.invalid", 400);
  try {
    let query = ctx.supabase.from(ctx.resource).select("*").order("created_at", { ascending: false });
    if (parsed.data.event_id) query = query.eq("event_id", parsed.data.event_id);
    const { data, error } = await query;
    if (error) { console.error("[admin] Read failed."); return apiError("error.generic", 503); }
    return NextResponse.json({ data });
  } catch { return apiError("error.generic", 503); }
}

async function write(request: Request, context: Context, method: "POST" | "PATCH" | "DELETE") {
  const ctx = await contextFor(context);
  if (!ctx.ok) return ctx.response;
  // RSVP insertions must use the capacity RPC in PR 2, never generic CRUD.
  if (ctx.resource === "event_rsvps" && method !== "DELETE") return apiError("error.methodNotAllowed", 405);
  let input: unknown;
  try { input = await request.json(); } catch { return apiError("validation.invalid", 400); }
  const schema = method === "DELETE" ? adminDeleteSchema : method === "PATCH" ? adminPatchSchema(ctx.resource) : resourceSchemas[ctx.resource];
  const parsed = schema.safeParse(input);
  if (!parsed.success) return apiError("validation.invalid", 400);
  try {
    if (method === "DELETE") {
      const { id } = adminDeleteSchema.parse(parsed.data);
      const { error } = await ctx.supabase.from(ctx.resource).delete().eq("id", id);
      if (error) { console.error("[admin] Delete failed."); return apiError("error.generic", 503); }
      return NextResponse.json({ ok: true });
    }
    if (method === "PATCH") {
      const { id, ...values } = parsed.data as Record<string, unknown>;
      const { data, error } = await ctx.supabase.from(ctx.resource).update(values).eq("id", id).select().single();
      if (error) {
        if (error.message === "event_schedule_locked") return apiError("rsvp.scheduleLocked", 409);
        if (error.message === "capacity_below_taken") return apiError("rsvp.capacityBelowTaken", 409);
        console.error("[admin] Update failed."); return apiError("error.generic", 503);
      }
      return NextResponse.json({ data });
    }
    const { data, error } = await ctx.supabase.from(ctx.resource).insert(parsed.data as Record<string, unknown>).select().single();
    if (error) { console.error("[admin] Insert failed."); return apiError("error.generic", 503); }
    return NextResponse.json({ data });
  } catch { return apiError("error.generic", 503); }
}

export async function POST(request: Request, context: Context) { return write(request, context, "POST"); }
export async function PATCH(request: Request, context: Context) { return write(request, context, "PATCH"); }
export async function DELETE(request: Request, context: Context) { return write(request, context, "DELETE"); }
