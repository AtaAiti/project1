import { getDictionary, type Locale } from "@/lib/dictionaries";
import { z } from "zod";
const safeInt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const user = z.looseObject({
  id: safeInt.positive(),
  is_bot: z.boolean().optional(),
  language_code: z.string().max(20).optional(),
});
const chat = z.looseObject({
  id: z
    .number()
    .int()
    .min(-Number.MAX_SAFE_INTEGER)
    .max(Number.MAX_SAFE_INTEGER),
  type: z.enum(["private", "group", "supergroup", "channel"]),
});
const message = z.looseObject({
  message_id: safeInt.positive(),
  chat,
  from: user.optional(),
  text: z.string().max(8192).optional(),
});
export const telegramUpdateSchema = z.looseObject({
  update_id: safeInt,
  message: message.optional(),
  callback_query: z
    .looseObject({
      id: z.string().max(256),
      from: user,
      message: message.optional(),
      data: z.string().max(64).optional(),
    })
    .optional(),
});
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
export const telegramJobSchema = z.object({
  method: z.enum(["sendMessage", "editMessageText", "answerCallbackQuery"]),
  params: z.record(z.string(), z.unknown()),
  admin_user_id: z.uuid().optional(),
  admin_telegram_id: safeInt.positive().optional(),
});
export type TelegramJob = z.infer<typeof telegramJobSchema>;
export type BookingRow = {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  comment: string;
  status: "pending" | "confirmed" | "declined";
  created_at: string;
};
export function botSiteUrl() {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://literator-xi.vercel.app";
}
export function telegramText(value: string, max = 3900) {
  return value.length <= max
    ? value
    : value.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, "") + "…";
}
export function parseBotCommand(text: string, username: string) {
  const match = /^\/([a-z]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(
    text.trim(),
  );
  if (!match || (match[2] && match[2].toLowerCase() !== username.toLowerCase()))
    return null;
  return { name: match[1].toLowerCase(), argument: (match[3] || "").trim() };
}

export function bookingActions(id: string, locale: Locale = "ru") {
  const t = getDictionary(locale).bot;
  return {
    inline_keyboard: [
      [
        { text: t.confirm, callback_data: `b:confirm:${id}` },
        { text: t.decline, callback_data: `b:decline:${id}` },
      ],
      [{ text: t.openAdmin, url: `${botSiteUrl()}/admin/bookings` }],
    ],
  };
}
