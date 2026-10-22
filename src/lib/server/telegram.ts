import { telegramText } from "@/lib/telegram-bot";
export type TelegramReplyMarkup = {
  inline_keyboard: Array<
    Array<{ text: string; callback_data?: string; url?: string }>
  >;
};
type TelegramMethod = "sendMessage" | "editMessageText" | "answerCallbackQuery";
export async function telegramCall(
  method: TelegramMethod,
  params: Record<string, unknown>,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, permanent: false, retryAfter: 30 };
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(8000),
      },
    );
    const result = await response.json();
    if (response.ok && result.ok)
      return { ok: true, permanent: false, retryAfter: 0 };
    if (
      method === "editMessageText" &&
      result.error_code === 400 &&
      typeof result.description === "string" &&
      result.description.toLowerCase().includes("message is not modified")
    )
      return { ok: true, permanent: false, retryAfter: 0 };
    console.error(
      "[telegram] Request failed with HTTP status",
      response.status,
    );
    const retry = Number(result.parameters?.retry_after);
    return {
      ok: false,
      permanent: response.status === 400 || response.status === 403,
      retryAfter:
        Number.isFinite(retry) && retry > 0 ? Math.min(3600, retry) : 5,
    };
  } catch {
    console.error("[telegram] Delivery unavailable.");
    return { ok: false, permanent: false, retryAfter: 5 };
  }
}
/** A persisted booking remains successful when notification delivery fails. */
export async function sendTelegram(
  text: string,
  replyMarkup?: TelegramReplyMarkup,
): Promise<boolean> {
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!process.env.TELEGRAM_BOT_TOKEN || !chat) return false;
  return (
    await telegramCall("sendMessage", {
      chat_id: chat,
      text: telegramText(text),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
  ).ok;
}
