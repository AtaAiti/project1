import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedAdminUser } from "@/lib/server/admin-access";
import { telegramCall } from "@/lib/server/telegram";
import { telegramJobSchema } from "@/lib/telegram-bot";
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type BotSettings = {
  bot_id: number;
  username: string;
  secret_hash: string;
  previous_secret_hash: string | null;
  previous_valid_until: string | null;
};
export type BotClient = ReturnType<typeof createAdminClient>;
export async function getBotSettings(
  client: BotClient,
): Promise<BotSettings | null> {
  const { data, error } = await client
    .from("telegram_settings")
    .select(
      "bot_id,username,secret_hash,previous_secret_hash,previous_valid_until",
    )
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error("Bot settings unavailable");
  return data;
}
export async function webAdminStillAllowed(client: BotClient, id: string) {
  const { data, error } = await client.auth.admin.getUserById(id);
  if (error) {
    if (error.status === 404) return false;
    throw new Error("Admin identity unavailable");
  }
  return isAllowedAdminUser(data.user);
}
export async function getBotActor(
  client: BotClient,
  bot: number,
  user: number,
  chat: number,
): Promise<string | null> {
  if (user !== chat || user <= 0) return null;
  const { data, error } = await client
    .from("telegram_admins")
    .select("web_user_id")
    .eq("bot_id", bot)
    .eq("telegram_user_id", user)
    .eq("chat_id", chat)
    .maybeSingle();
  if (error) throw new Error("Bot binding unavailable");
  return data && (await webAdminStillAllowed(client, data.web_user_id))
    ? data.web_user_id
    : null;
}
export async function drainBotReplies(
  client: BotClient,
  bot: number,
  update: number,
) {
  for (let i = 0; i < 8; i++) {
    const { data, error } = await client.rpc("claim_telegram_delivery", {
      p_bot_id: bot,
      p_update_id: update,
    });
    if (error) throw new Error("Bot delivery queue unavailable");
    const job = data?.[0];
    if (!job) break;
    const parsed = telegramJobSchema.safeParse(job.job);
    let result = { ok: false, permanent: true, retryAfter: 0 };
    if (parsed.success) {
      const { admin_user_id, admin_telegram_id, method, params } = parsed.data;
      const permitted =
        !admin_user_id ||
        (admin_telegram_id &&
          (await getBotActor(
            client,
            bot,
            admin_telegram_id,
            admin_telegram_id,
          )) === admin_user_id);
      if (permitted) result = await telegramCall(method, params);
    }
    const ack = await client.rpc("ack_telegram_delivery", {
      p_id: job.id,
      p_lease: job.lease_token,
      p_success: result.ok,
      p_permanent: result.permanent,
      p_retry_after: result.retryAfter,
    });
    if (ack.error || !ack.data)
      throw new Error("Bot delivery acknowledgment failed");
    if (!result.ok && !result.permanent) return false;
  }
  const { count, error } = await client
    .from("telegram_outbox")
    .select("id", { count: "exact", head: true })
    .eq("bot_id", bot)
    .eq("update_id", update)
    .is("delivered_at", null)
    .is("dead_at", null);
  if (error) throw new Error("Bot queue state unavailable");
  return count === 0;
}
