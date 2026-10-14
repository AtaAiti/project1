import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/server/admin";
import { isOwnerUser } from "@/lib/server/admin-access";
import { adminEmailSchema } from "@/lib/schemas";
import { apiError } from "@/lib/server/api-error";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
async function owner() {
  const auth = await authorizeAdmin();
  if (auth.status !== 200)
    return {
      response: apiError(
        auth.status === 401 ? "error.unauthorized" : "error.forbidden",
        auth.status,
      ),
    };
  if (!isOwnerUser(auth.user))
    return { response: apiError("error.forbidden", 403) };
  return { auth };
}
export async function GET() {
  const ctx = await owner();
  if (ctx.response) return ctx.response;
  try {
    const { data, error } = await ctx.auth.supabase
      .from("admin_members")
      .select("email,created_at")
      .order("created_at", { ascending: false });
    if (error) return apiError("error.generic", 503);
    return NextResponse.json({ data });
  } catch {
    return apiError("error.generic", 503);
  }
}
async function write(request: Request, method: "POST" | "DELETE") {
  const ctx = await owner();
  if (ctx.response) return ctx.response;
  const url = new URL(request.url),
    origin = `${request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1)}://${request.headers.get("host") || url.host}`;
  if (request.headers.get("origin") !== origin)
    return apiError("error.forbidden", 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("validation.email", 400);
  }
  const parsed = adminEmailSchema.safeParse(body);
  if (!parsed.success) return apiError("validation.email", 400);
  const email = parsed.data.email;
  try {
    if (method === "DELETE") {
      const { error } = await ctx.auth.supabase
        .from("admin_members")
        .delete()
        .eq("email", email);
      if (error) return apiError("error.generic", 503);
      return NextResponse.json({ ok: true });
    }
    if (
      !(await rateLimit(rateLimitKey(request, "admin-invite"), 10, 3600))
        .allowed
    )
      return apiError("error.emailRateLimited", 429);
    if (email === ctx.auth.user.email?.trim().toLowerCase())
      return NextResponse.json({ ok: true, owner: true });
    const { error } = await ctx.auth.supabase
      .from("admin_members")
      .upsert({ email }, { onConflict: "email" });
    if (error) return apiError("error.generic", 503);
    const { error: inviteError } =
      await ctx.auth.supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/admin/reset-password`,
      });
    const existing =
      inviteError &&
      ["email_exists", "user_already_exists"].includes(inviteError.code || "");
    if (inviteError && !existing)
      console.error(
        "[admin] Team invitation email rejected:",
        inviteError.code || "unknown",
      );
    return NextResponse.json({
      ok: true,
      invitationSent: !inviteError,
      existingAccount: Boolean(existing),
    });
  } catch {
    console.error("[admin] Team request failed.");
    return apiError("error.generic", 503);
  }
}
export async function POST(request: Request) {
  return write(request, "POST");
}
export async function DELETE(request: Request) {
  return write(request, "DELETE");
}
