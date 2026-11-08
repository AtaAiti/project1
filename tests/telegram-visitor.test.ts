import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { visitorUpdate } from "@/lib/server/telegram-bot/visitor";
import type { BotClient } from "@/lib/server/telegram-bot/store";
import type { TelegramJob } from "@/lib/telegram-bot";
const rpc = vi.fn();
let menu: object[] = [];
const client = { rpc, from: () => {
  const chain = { select: () => chain, order: () => chain, then: (resolve: (v: object) => void) => resolve({ data: menu, error: null }) };
  return chain;
} } as unknown as BotClient;
const reply = (text: string, markup?: object): TelegramJob[] => [{ method: "sendMessage", params: { chat_id: 20, text, reply_markup: markup } }];
let state: unknown;
async function update(name: string, text = "", data?: string) {
  const result = await visitorUpdate({ client, locale: "ru", name, arg: "", text, data, sessionFlow: state, reply });
  if (result?.action === "guest_flow") state = result.replies.flow;
  return result!;
}
async function click(op: string, value = "") {
  return update("unknown", "", `g:${(state as { token: string }).token}:${op}:${value}`);
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-08T05:00:00Z"));
  state = null; menu = [];
  rpc.mockReset(); rpc.mockResolvedValue({ data: [{ id: "T1" }, { id: "T3" }], error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it("books entirely in Telegram, normalizes phone and queues owner notification", async () => {
  vi.stubEnv("TELEGRAM_CHAT_ID", "99");
  await update("book");
  const date = await click("date", "2026-11-09");
  expect(date.replies.flow).toMatchObject({ step: "time" });
  await click("time", "18:00");
  const tables = await click("guests", "2");
  expect(tables.replies.flow).toMatchObject({ step: "table" });
  expect(JSON.stringify(tables.replies.normal)).toContain("T1");
  expect(JSON.stringify(tables.replies.normal)).not.toContain("T2");
  await click("table", "T1");
  await update("guestText", "Иван");
  await update("guestText", "0700123456");
  expect(state).toMatchObject({ step: "review", phone: "+996700123456" });
  const saved = await click("submit");
  expect(saved.action).toBe("guest_booking");
  expect(saved.replies.guest_booking).toMatchObject({ name: "Иван", phone: "+996700123456", table_id: "T1", date: "2026-11-09", time: "18:00", guests: 2 });
  expect(saved.replies.normal).toHaveLength(2);
  for (const outcome of ["normal", "stale", "past", "table_conflict", "booking_limit"]) expect(saved.replies[outcome]).toBeTruthy();
});
it("rejects stale and expired callbacks and cancels without booking", async () => {
  await update("book");
  const prior = state;
  const stale = await update("unknown", "", "g:old:date:2026-11-09");
  expect(stale.action).toBe("none"); expect(state).toEqual(prior);
  const cancelled = await click("cancel");
  expect(cancelled.replies.flow).toBeNull();
  await update("book"); vi.advanceTimersByTime(21 * 60_000);
  const expired = await click("date", "2026-11-09");
  expect(expired.replies.flow).toBeNull(); expect(expired.action).toBe("guest_flow");
  expect(rpc).not.toHaveBeenCalled();
});
it("rechecks a table before collecting contact data", async () => {
  await update("tables"); await click("date", "2026-11-09"); await click("time", "18:00"); await click("guests", "2");
  rpc.mockResolvedValue({ data: [], error: null });
  const conflict = await click("table", "T1");
  expect(conflict.replies.flow).toMatchObject({ step: "table", name: "", phone: "" });
});
it("validates text responses and fits callback data within Telegram limits", async () => {
  await update("book"); await click("date", "2026-11-09"); await click("time", "18:00");
  expect((await update("guestText", "100")).replies.flow).toMatchObject({ step: "guests" });
  const result = await click("guests", "2");
  for (const job of result.replies.normal as TelegramJob[]) {
    const markup = job.params.reply_markup as { inline_keyboard: { callback_data: string }[][] };
    for (const row of markup.inline_keyboard) for (const b of row) expect(Buffer.byteLength(b.callback_data)).toBeLessThanOrEqual(64);
  }
  await click("table", "T1"); await update("guestText", "Иван");
  expect((await update("guestText", "not a phone")).replies.flow).toMatchObject({ step: "phone" });
});
it("shows actual menu categories, composition, portions and prices inside the bot", async () => {
  menu = [{ id: "1", category: "Кофе", name_ru: "Капучино", name_en: "Cappuccino", composition_ru: "Кофе, молоко", composition_en: "Coffee, milk", portion_ru: "250 мл", portion_en: "250 ml", price: 250, is_hit: true }];
  expect(JSON.stringify((await update("menu")).replies.normal)).toContain("m:0:0");
  const result = await update("unknown", "", "m:0:0");
  for (const text of ["Капучино", "Кофе, молоко", "250 мл", "250"]) expect(JSON.stringify(result.replies.normal)).toContain(text);
});
