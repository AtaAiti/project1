import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramUpdateSchema } from "@/lib/telegram-bot";
import { getBotSettings, hashToken } from "@/lib/server/telegram-bot/store";
import { handleBotUpdate } from "@/lib/server/telegram-bot/handler";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret))
    return new Response(null, { status: 401 });
  try {
    const client = createAdminClient(),
      settings = await getBotSettings(client);
    if (!settings) return new Response(null, { status: 503 });
    const candidate = Buffer.from(hashToken(secret), "hex");
    const matches = (value: string | null) =>
      Boolean(
        value &&
        /^[a-f0-9]{64}$/.test(value) &&
        timingSafeEqual(candidate, Buffer.from(value, "hex")),
      );
    if (
      !matches(settings.secret_hash) &&
      !(
        settings.previous_valid_until &&
        Date.parse(settings.previous_valid_until) > Date.now() &&
        matches(settings.previous_secret_hash)
      )
    )
      return new Response(null, { status: 401 });
    if (!request.headers.get("content-type")?.includes("application/json"))
      return new Response(null, { status: 415 });
    if (Number(request.headers.get("content-length")) > 65536)
      return new Response(null, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return new Response(null, { status: 400 });
    }
    const update = telegramUpdateSchema.safeParse(body);
    if (!update.success) return new Response(null, { status: 400 });
    if (!(await handleBotUpdate(client, settings, update.data)))
      return new Response(null, {
        status: 503,
        headers: { "Retry-After": "5" },
      });
    return Response.json({ ok: true });
  } catch {
    console.error("[telegram] Webhook temporarily unavailable.");
    return new Response(null, { status: 503, headers: { "Retry-After": "5" } });
  }
}
