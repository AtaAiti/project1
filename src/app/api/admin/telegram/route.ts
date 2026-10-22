import { authorizeAdmin } from "@/lib/server/admin";
import { apiError } from "@/lib/server/api-error";
import { getBotSettings } from "@/lib/server/telegram-bot/store";
export async function GET() {
  const auth = await authorizeAdmin();
  if (auth.status !== 200)
    return apiError(
      auth.status === 401 ? "error.unauthorized" : "error.forbidden",
      auth.status,
    );
  try {
    const settings = await getBotSettings(auth.supabase);
    const binding = settings
      ? await auth.supabase
          .from("telegram_admins")
          .select("telegram_user_id")
          .eq("bot_id", settings.bot_id)
          .eq("web_user_id", auth.user.id)
          .maybeSingle()
      : { data: null, error: null };
    if (binding.error) throw new Error();
    return Response.json(
      {
        ready: Boolean(settings),
        connected: Boolean(binding.data),
        username: settings?.username ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return apiError("error.generic", 503);
  }
}
