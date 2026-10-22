import { randomBytes } from "node:crypto";
import { authorizeAdmin } from "@/lib/server/admin";
import { apiError } from "@/lib/server/api-error";
import { rateLimit } from "@/lib/rate-limit";
import { getBotSettings, hashToken } from "@/lib/server/telegram-bot/store";
export async function POST() {
  const auth = await authorizeAdmin();
  if (auth.status !== 200)
    return apiError(
      auth.status === 401 ? "error.unauthorized" : "error.forbidden",
      auth.status,
    );
  try {
    if (!(await rateLimit(`telegram-link:${auth.user.id}`, 5, 600)).allowed)
      return apiError("error.rateLimited", 429);
    const settings = await getBotSettings(auth.supabase);
    if (!settings) return apiError("error.generic", 503);
    const token = randomBytes(32).toString("base64url"),
      expires = new Date(Date.now() + 600000).toISOString();
    const removed = await auth.supabase
      .from("telegram_link_tokens")
      .delete()
      .eq("web_user_id", auth.user.id);
    if (removed.error) throw new Error();
    const result = await auth.supabase
      .from("telegram_link_tokens")
      .insert({
        token_hash: hashToken(token),
        web_user_id: auth.user.id,
        expires_at: expires,
      });
    if (result.error) throw new Error();
    return Response.json(
      { url: `https://t.me/${settings.username}?start=link_${token}`, expires },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return apiError("error.generic", 503);
  }
}
export async function DELETE() {
  const auth = await authorizeAdmin();
  if (auth.status !== 200)
    return apiError(
      auth.status === 401 ? "error.unauthorized" : "error.forbidden",
      auth.status,
    );
  try {
    for (const table of ["telegram_admins", "telegram_link_tokens"]) {
      const result = await auth.supabase
        .from(table)
        .delete()
        .eq("web_user_id", auth.user.id);
      if (result.error) throw new Error();
    }
    return Response.json({ ok: true });
  } catch {
    return apiError("error.generic", 503);
  }
}
