export type TelegramReplyMarkup = { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };

/** A persisted booking is successful even when notification delivery fails. Never log tokens or URLs. */
export async function sendTelegram(text: string, replyMarkup?: TelegramReplyMarkup): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) { console.error("[telegram] Notification failed with HTTP status", response.status); return false; }
    const result = await response.json();
    if (!result.ok) { console.error("[telegram] Notification rejected by Telegram."); return false; }
    return true;
  } catch {
    console.error("[telegram] Notification delivery failed; the saved request is preserved.");
    return false;
  }
}
