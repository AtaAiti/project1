import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { getDictionary, type Locale } from "@/lib/dictionaries";
import { addVenueDays, bookingEndTime, bookingSlots, venueToday } from "@/lib/booking-time";
import { validateBookingInput } from "@/lib/booking-validation";
import { phoneSchema } from "@/lib/schemas";
import { VENUE_TABLES, findVenueTable } from "@/lib/venue-tables";
import { availableTableIds } from "@/lib/server/table-availability";
import { bookingActions, telegramText, type TelegramJob } from "@/lib/telegram-bot";
import type { BotClient } from "./store";

const flowSchema = z.object({
  token: z.string(), expires: z.iso.datetime(),
  step: z.enum(["date", "time", "guests", "table", "name", "phone", "review"]),
  date: z.string().default(""), time: z.string().default(""), guests: z.number().int().min(1).max(20).default(2),
  table_id: z.string().default(""), name: z.string().default(""), phone: z.string().default(""),
});
type Flow = z.infer<typeof flowSchema>;
type Button = { text: string; callback_data: string };
type Reply = (text: string, markup?: object) => TelegramJob[];
type VisitorResult = { action: "guest_flow" | "guest_booking" | "none"; replies: Record<string, unknown> };

export async function visitorUpdate({ client, locale, name, arg, data, text, sessionFlow, reply }: {
  client: BotClient; locale: Locale; name: string; arg: string; data?: string; text: string;
  sessionFlow: unknown; reply: Reply;
}): Promise<VisitorResult | null> {
  const d = getDictionary(locale), t = d.visit;
  const parsed = flowSchema.safeParse(sessionFlow);
  const prior = parsed.success ? parsed.data : null;
  const expected = prior?.token ?? "";
  const isGuest = data?.startsWith("g:");
  const empty: Flow = { token: "", expires: "", step: "date", date: "", time: "", guests: 2, table_id: "", name: "", phone: "" };
  const flow = { ...(prior ?? empty), token: randomBytes(4).toString("hex"), expires: new Date(Date.now() + 20 * 60_000).toISOString() };
  const button = (text: string, op: string, value = ""): Button => ({ text, callback_data: `g:${flow.token}:${op}:${value}` });
  const nav = [[{ text: d.bot.book, callback_data: "v:book" }, { text: d.bot.menu, callback_data: "v:menu" }]];
  const cancel = [button(t.back, "back"), button(t.cancel, "cancel")];
  const done = (message: string, markup: object = { inline_keyboard: nav }): VisitorResult => ({ action: "guest_flow", replies: { expected_token: expected, flow: null, normal: reply(message, markup), stale: reply(t.stale, { inline_keyboard: nav }) } });
  const render = (message: string, rows: Button[][]): VisitorResult => ({ action: "guest_flow", replies: { expected_token: expected, flow, normal: reply(message, { inline_keyboard: rows }), stale: reply(t.stale, { inline_keyboard: nav }) } });
  function dates(offset = 0) {
    flow.step = "date";
    const today = venueToday();
    const rows = Array.from({ length: 7 }, (_, i) => {
      const date = addVenueDays(today, offset + i);
      const label = offset + i === 0 ? t.today : offset + i === 1 ? t.tomorrow : new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
      return [button(label, "date", date)];
    });
    rows.push([...(offset ? [button(d.bot.previous, "dates", String(Math.max(0, offset - 7)))] : []), button(d.bot.next, "dates", String(offset + 7))], [button(t.cancel, "cancel")]);
    return render(`${t.title}\n${t.date}\n${t.duration}`, rows);
  }
  function times() {
    flow.step = "time";
    const slots = bookingSlots(flow.date);
    const rows: Button[][] = [];
    for (let i = 0; i < slots.length; i += 4) rows.push(slots.slice(i, i + 4).map((slot) => button(slot, "time", slot)));
    rows.push(cancel);
    return render(`${flow.date}\n${slots.length ? t.time : t.noSlots}\n${t.duration}`, rows);
  }
  async function tables() {
    flow.step = "table";
    const available = await availableTableIds(flow.date, flow.time, flow.guests, client);
    const rows = VENUE_TABLES.filter((table) => available.includes(table.id)).map((table) => [button(`${table.id} · ${d.tables.seats}: ${table.seats} · ${d.tables.zones[table.zone]}`, "table", table.id)]);
    rows.push(cancel);
    return render(`${flow.date} · ${flow.time}–${bookingEndTime(flow.time)} · ${t.guests}: ${flow.guests}\n\n${available.length ? d.bot.tables : t.noTables}`, rows);
  }
  const summary = () => `${flow.date} · ${flow.time}–${bookingEndTime(flow.time)} (Asia/Bishkek)\n${d.tables.table}: ${flow.table_id} · ${t.guests}: ${flow.guests}\n${flow.name}\n${flow.phone}`;

  if (name === "menu" || data?.startsWith("m:")) {
    const result = await client.from("menu_items").select("id,category,name_ru,name_en,composition_ru,composition_en,strength,portion_ru,portion_en,price,is_hit").order("category").order("id");
    if (result.error) throw new Error("Menu unavailable");
    const items = result.data ?? [];
    const categories: string[] = [...new Set<string>(items.map((item) => item.category))];
    const labels = d.publicUi.categoryLabels;
    const label = (value: string) => labels[value as keyof typeof labels] ?? value;
    if (!data?.startsWith("m:")) return done(items.length ? t.categories : t.emptyMenu, { inline_keyboard: [...categories.map((category, i) => [{ text: label(category), callback_data: `m:${i}:0` }]), ...nav] });
    const match = /^m:(\d{1,4}):(\d{1,5})$/.exec(data);
    if (!match || !categories[Number(match[1])]) return done(t.stale);
    const index = Number(match[1]), offset = Number(match[2]);
    const rows = items.filter((item) => item.category === categories[index]);
    const shown = rows.slice(offset, offset + 4);
    const page = shown.map((item) => `${item.is_hit ? "★ " : ""}${item[`name_${locale}`]} — ${item.price} ${d.publicUi.currency}\n${telegramText(item[`composition_${locale}`] || "", 350)}\n${item[`portion_${locale}`] || ""}${item.strength ? ` · ${item.strength}` : ""}`).join("\n\n");
    return done(`${label(categories[index])}\n\n${page || t.emptyMenu}`, { inline_keyboard: [[...(offset ? [{ text: d.bot.previous, callback_data: `m:${index}:${Math.max(0, offset - 4)}` }] : []), ...(rows.length > offset + 4 ? [{ text: d.bot.next, callback_data: `m:${index}:${offset + 4}` }] : [])], [{ text: t.back, callback_data: "v:menu" }], ...nav].filter((row) => row.length) });
  }
  if (["book", "book_a_table", "tables"].includes(name)) return dates();
  if (name === "cancel") return done(t.cancelled);
  if (!isGuest && !(name === "guestText" && prior)) return null;
  if (!prior || Date.parse(prior.expires) <= Date.now()) return done(t.expired);
  const parts = data?.split(":") ?? [];
  if (isGuest && parts[1] !== prior.token) return { action: "none", replies: { normal: reply(t.stale, { inline_keyboard: nav }) } };
  const op = parts[2], value = parts.slice(3).join(":");
  if (op === "cancel") return done(t.cancelled);
  if (op === "back") return dates();
  if (op === "dates" && flow.step === "date" && /^\d{1,4}$/.test(value)) return dates(Math.min(365, Number(value)));
  const dateInput = op === "date" ? value : name === "guestText" && flow.step === "date" ? text.trim() : "";
  if (flow.step === "date" && dateInput) {
    if (!z.iso.date().safeParse(dateInput).success || dateInput < venueToday()) return render(d.errors["validation.date"], [cancel]);
    flow.date = dateInput;
    return times();
  }
  const timeInput = op === "time" ? value : name === "guestText" && flow.step === "time" ? text.trim() : "";
  if (flow.step === "time" && timeInput) {
    if (!bookingSlots(flow.date).includes(timeInput)) return times();
    flow.time = timeInput; flow.step = "guests";
    return render(`${flow.date} · ${flow.time}\n${t.guests}`, [[1, 2, 3].map((n) => button(String(n), "guests", String(n))), [4, 5, 6].map((n) => button(String(n), "guests", String(n))), cancel]);
  }
  const guestsInput = op === "guests" ? value : name === "guestText" && flow.step === "guests" ? text.trim() : "";
  if (flow.step === "guests" && guestsInput) {
    if (!/^[1-6]$/.test(guestsInput)) return render(d.errors["validation.guests"], [cancel]);
    flow.guests = Number(guestsInput);
    return tables();
  }
  if (flow.step === "table" && op === "table") {
    const table = findVenueTable(value);
    if (!table || table.seats < flow.guests) return tables();
    if (!(await availableTableIds(flow.date, flow.time, flow.guests, client)).includes(value)) return tables();
    flow.table_id = value; flow.step = "name";
    return render(t.name, [cancel]);
  }
  if (flow.step === "name" && name === "guestText") {
    if (!text.trim() || text.trim().length > 200) return render(d.errors["validation.required"], [cancel]);
    flow.name = text.trim(); flow.step = "phone";
    return render(t.phone, [cancel]);
  }
  if (flow.step === "phone" && name === "guestText") {
    const phone = phoneSchema.safeParse(text.trim());
    if (!phone.success) return render(`${d.errors["validation.phone"]}\n${t.phone}`, [cancel]);
    flow.phone = phone.data; flow.step = "review";
    return render(`${t.review}\n\n${summary()}\n\n${t.duration}`, [[button(t.confirm, "submit")], cancel]);
  }
  if (flow.step === "review" && op === "submit") {
    const table = findVenueTable(flow.table_id);
    const comment = `${d.tables.requestLabel} ${flow.table_id} (${d.tables.capacityLabel}: ${table?.seats}, ${table ? d.tables.zones[table.zone] : ""})\nTelegram`;
    const input = { name: flow.name, phone: flow.phone, date: flow.date, time: flow.time, guests: flow.guests, table_id: flow.table_id, comment };
    const validation = validateBookingInput(input);
    if (validation.errorKey) return done(d.errors[validation.errorKey]);
    const id = randomUUID();
    const jobs = reply(`${t.saved.replace("{booking_id}", id)}\n\n${summary()}`, { inline_keyboard: nav });
    const owner = process.env.TELEGRAM_CHAT_ID;
    if (owner && /^\d+$/.test(owner)) jobs.push({ method: "sendMessage", params: { chat_id: owner, text: telegramText(`${getDictionary("ru").telegram.newBooking} ${id}\n${summary()}\n${comment}`), reply_markup: bookingActions(id, "ru") } });
    return { action: "guest_booking", replies: { expected_token: expected, guest_booking: { ...validation.data, id }, normal: jobs, table_conflict: reply(d.errors["validation.tableUnavailable"], { inline_keyboard: nav }), past: reply(d.errors["validation.bookingPast"], { inline_keyboard: nav }), booking_limit: reply(t.bookingLimit, { inline_keyboard: nav }), stale: reply(t.stale, { inline_keyboard: nav }) } };
  }
  return render(t.stale, [cancel]);
}
