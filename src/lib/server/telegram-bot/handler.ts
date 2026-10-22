import { z } from "zod";
import { getDictionary, type Locale } from "@/lib/dictionaries";
import { venueToday } from "@/lib/booking-time";
import { rateLimit } from "@/lib/rate-limit";
import {
  bookingActions,
  botSiteUrl,
  parseBotCommand,
  telegramText,
  type TelegramUpdate,
  type TelegramJob,
  type BookingRow,
} from "@/lib/telegram-bot";
import {
  drainBotReplies,
  getBotActor,
  hashToken,
  webAdminStillAllowed,
  type BotClient,
  type BotSettings,
} from "./store";

export async function handleBotUpdate(
  client: BotClient,
  settings: BotSettings,
  update: TelegramUpdate,
) {
  const bot = settings.bot_id;
  const existing = await client
    .from("telegram_updates")
    .select("update_id")
    .eq("bot_id", bot)
    .eq("update_id", update.update_id)
    .maybeSingle();
  if (existing.error) throw new Error("Bot update state unavailable");
  if (existing.data) return drainBotReplies(client, bot, update.update_id);
  const cb = update.callback_query,
    message = cb?.message ?? update.message,
    user = cb?.from ?? message?.from;
  let locale: Locale = user?.language_code?.startsWith("ru") ? "ru" : "en";
  const chat = message?.chat;
  const valid =
    chat?.type === "private" && user && !user.is_bot && chat.id === user.id;
  let action = "none",
    bookingId: string | null = null,
    actor: string | null = null,
    linkHash: string | null = null;
  let replies: Record<string, unknown> = { normal: [] };
  if (valid) {
    const session = await client
      .from("telegram_sessions")
      .select("locale")
      .eq("bot_id", bot)
      .eq("chat_id", chat.id)
      .maybeSingle();
    if (session.error) throw new Error("Bot language unavailable");
    if (session.data) locale = session.data.locale;
    if (cb?.data === "lang:ru" || cb?.data === "lang:en")
      locale = cb.data.slice(5) as Locale;
    if ((await rateLimit(`tg:${bot}:${user.id}`, 25, 60)).allowed) {
      const d = getDictionary(locale),
        t = d.bot;
      actor = await getBotActor(client, bot, user.id, chat.id);
      const labels = {
        pending: t.pendingStatus,
        confirmed: t.confirmedStatus,
        declined: t.declinedStatus,
      };
      const links = {
        inline_keyboard: [
          [
            { text: t.menu, url: `${botSiteUrl()}/${locale}/menu` },
            { text: t.tables, url: `${botSiteUrl()}/${locale}/tables` },
          ],
          [
            { text: t.events, url: `${botSiteUrl()}/${locale}/afisha` },
            { text: t.book, url: `${botSiteUrl()}/${locale}/contacts#booking` },
          ],
          [
            { text: t.site, url: `${botSiteUrl()}/${locale}` },
            { text: t.contacts, url: `${botSiteUrl()}/${locale}/contacts` },
          ],
          [
            { text: "Русский", callback_data: "lang:ru" },
            { text: "English", callback_data: "lang:en" },
          ],
        ],
      };
      function reply(
        text: string,
        markup: object = links,
        privateReply = false,
      ): TelegramJob[] {
        const tag =
          privateReply && actor
            ? { admin_user_id: actor, admin_telegram_id: user!.id }
            : {};
        const job: TelegramJob = {
          method: cb ? "editMessageText" : "sendMessage",
          params: {
            chat_id: chat!.id,
            ...(cb ? { message_id: message!.message_id } : {}),
            text: telegramText(text),
            reply_markup: markup,
          },
          ...tag,
        };
        return cb
          ? [
              {
                method: "answerCallbackQuery",
                params: { callback_query_id: cb.id },
              },
              job,
            ]
          : [job];
      }
      const cmd = parseBotCommand(message?.text ?? "", settings.username);
      let name = cmd?.name ?? "unknown",
        arg = cmd?.argument ?? "";
      if (cb) {
        if (cb.data?.startsWith("lang:")) name = "languageSaved";
        else if (cb.data?.startsWith("b:")) {
          const parts = cb.data.split(":");
          name =
            (
              {
                view: "booking",
                confirm: "confirm",
                decline: "decline",
                reject: "reject",
              } as Record<string, string>
            )[parts[1]] ?? "unknown";
          arg = parts[2] ?? "";
        } else if (cb.data?.startsWith("list:")) {
          const parts = cb.data.split(":");
          name = parts[1];
          arg = parts[2] ?? "0";
        }
      }
      const privileged = [
        "today",
        "pending",
        "booking",
        "confirm",
        "decline",
        "reject",
        "admin",
      ].includes(name);
      if (name === "start" && arg.startsWith("link_")) {
        if (/^link_[A-Za-z0-9_-]{43}$/.test(arg)) {
          linkHash = hashToken(arg.slice(5));
          const token = await client
            .from("telegram_link_tokens")
            .select("web_user_id,expires_at")
            .eq("token_hash", linkHash)
            .maybeSingle();
          if (token.error) throw new Error("Bot link unavailable");
          if (
            token.data &&
            Date.parse(token.data.expires_at) > Date.now() &&
            (await webAdminStillAllowed(client, token.data.web_user_id))
          ) {
            action = "link";
            actor = token.data.web_user_id;
          }
        }
        replies = {
          normal: reply(
            action === "link" ? t.linked : t.linkExpired,
            {},
            action === "link",
          ),
          link_expired: reply(t.linkExpired, {}),
        };
      } else if (privileged && !actor) replies = { normal: reply(t.notAdmin) };
      else if (["booking", "confirm", "decline", "reject"].includes(name)) {
        if (!z.uuid().safeParse(arg).success)
          replies = { normal: reply(t.syntax, {}, true) };
        else {
          const result = await client
            .from("bookings")
            .select("id,name,phone,date,time,guests,comment,status,created_at")
            .eq("id", arg)
            .maybeSingle();
          if (result.error) throw new Error("Booking unavailable");
          const b = result.data as BookingRow | null;
          if (!b) replies = { normal: reply(t.missing, {}, true) };
          else {
            const audit = await client
              .from("booking_status_audit")
              .select("actor_user_id,created_at")
              .eq("booking_id", b.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (audit.error) throw new Error("Booking audit unavailable");
            const history = audit.data
              ? `\n${t.decisionBy}: ${audit.data.actor_user_id} · ${new Date(audit.data.created_at).toLocaleString(locale, { timeZone: "Asia/Bishkek" })} (Asia/Bishkek)`
              : "";
            const card = `${t.booking} ${b.id}\n${b.name}, ${b.phone}\n${b.date} ${b.time.slice(0, 5)} · Asia/Bishkek\n${d.booking.guests}: ${b.guests}\n${t.status}: ${labels[b.status]}\n${telegramText(b.comment || "", 2400)}${history}`;
            const controls =
              b.status === "pending"
                ? bookingActions(b.id, locale)
                : {
                    inline_keyboard: [
                      [
                        {
                          text: t.openAdmin,
                          url: `${botSiteUrl()}/admin/bookings`,
                        },
                      ],
                    ],
                  };
            if (name === "confirm" || name === "reject") {
              action = name === "confirm" ? "confirm" : "decline";
              bookingId = b.id;
              const refresh = {
                inline_keyboard: [
                  [{ text: t.refresh, callback_data: `b:view:${b.id}` }],
                ],
              };
              replies = {
                status_labels: labels,
                changed: reply(
                  `${t.changed}\n${t.booking} ${b.id}\n${t.status}: {booking_status}`,
                  refresh,
                  true,
                ),
                already: reply(t.already, refresh, true),
                conflict: reply(t.conflict, refresh, true),
                not_found: reply(t.missing, {}, true),
                past: reply(t.past, controls, true),
              };
            } else if (name === "decline" && b.status === "pending")
              replies = {
                normal: reply(
                  `${t.declinePrompt}\n\n${card}`,
                  {
                    inline_keyboard: [
                      [
                        {
                          text: t.rejectConfirm,
                          callback_data: `b:reject:${b.id}`,
                        },
                      ],
                      [{ text: t.cancel, callback_data: `b:view:${b.id}` }],
                    ],
                  },
                  true,
                ),
              };
            else replies = { normal: reply(card, controls, true) };
          }
        }
      } else if (name === "today" || name === "pending") {
        const offset = /^\d{1,5}$/.test(arg) ? Math.min(10000, Number(arg)) : 0;
        let q = client
          .from("bookings")
          .select("id,name,phone,date,time,guests,comment,status,created_at");
        q =
          name === "today"
            ? q
                .eq("date", venueToday())
                .order("status")
                .order("time")
                .order("id")
            : q.eq("status", "pending").order("created_at").order("id");
        const result = await q.range(offset, offset + 5);
        if (result.error) throw new Error("Booking list unavailable");
        const rows = (result.data ?? []) as BookingRow[],
          shown = rows.slice(0, 5);
        const text = `${name === "today" ? `${t.today} · ${venueToday()}` : t.pending}\n\n${shown.length ? shown.map((b) => `${telegramText(b.name, 60)} · ${b.date} ${b.time.slice(0, 5)} · ${b.guests}\n${labels[b.status]}\n${b.id}`).join("\n\n") : t.empty}\n\n${t.listHint}`;
        const keyboard = shown.map((b, i) => [
          {
            text: `${offset + i + 1}. ${telegramText(b.name, 35)}`,
            callback_data: `b:view:${b.id}`,
          },
        ]);
        const pages = [];
        if (offset > 0)
          pages.push({
            text: t.previous,
            callback_data: `list:${name}:${Math.max(0, offset - 5)}`,
          });
        if (rows.length > 5)
          pages.push({
            text: t.next,
            callback_data: `list:${name}:${offset + 5}`,
          });
        if (pages.length) keyboard.push(pages);
        replies = { normal: reply(text, { inline_keyboard: keyboard }, true) };
      } else if (name === "events") {
        const result = await client
          .from("events")
          .select("id,title_ru,title_en,date,time,capacity")
          .eq("status", "published")
          .gte("date", venueToday())
          .order("date")
          .order("time")
          .limit(10);
        if (result.error) throw new Error("Events unavailable");
        const events = (result.data ?? [])
          .filter((e) => Date.parse(`${e.date}T${e.time}+06:00`) > Date.now())
          .slice(0, 5);
        const counts = events.length
          ? await client
              .from("event_seats")
              .select("event_id,seats_taken")
              .in(
                "event_id",
                events.map((e) => e.id),
              )
          : { data: [], error: null };
        if (counts.error) throw new Error("Event seats unavailable");
        const text =
          events
            .map(
              (e) =>
                `${e[`title_${locale}`]}\n${e.date} ${e.time.slice(0, 5)} · Asia/Bishkek${e.capacity == null ? "" : `\n${t.seats}: ${Math.max(0, e.capacity - Number(counts.data?.find((s) => s.event_id === e.id)?.seats_taken ?? 0))}`}`,
            )
            .join("\n\n") || t.noEvents;
        replies = {
          normal: reply(text, {
            inline_keyboard: events.map((e) => [
              {
                text: telegramText(e[`title_${locale}`], 70),
                url: `${botSiteUrl()}/${locale}/afisha/${e.id}`,
              },
            ]),
          }),
        };
      } else if (name === "language")
        replies = {
          normal: reply(t.language, {
            inline_keyboard: [
              [
                { text: "Русский", callback_data: "lang:ru" },
                { text: "English", callback_data: "lang:en" },
              ],
            ],
          }),
        };
      else if (name === "contacts")
        replies = {
          normal: reply(
            `${d.publicUi.address}\n${d.publicUi.addressNote}\n${d.publicUi.phone}\n${d.publicUi.hours}`,
          ),
        };
      else if (name === "admin")
        replies = {
          normal: reply(
            t.adminHelp,
            {
              inline_keyboard: [
                [{ text: t.openAdmin, url: `${botSiteUrl()}/admin` }],
              ],
            },
            true,
          ),
        };
      else if (["start", "help", "languageSaved"].includes(name))
        replies = {
          normal: reply(
            `${name === "start" ? t.welcome : name === "help" ? t.help : t.languageSaved}${actor ? `\n\n${t.adminHelp}` : ""}`,
          ),
        };
      else if (["site", "menu", "tables", "book"].includes(name))
        replies = {
          normal: reply(t[name as "site" | "menu" | "tables" | "book"]),
        };
      else replies = { normal: reply(t.unknown) };
    }
  }
  if (
    valid &&
    cb &&
    Array.isArray(replies.normal) &&
    replies.normal.length === 0
  )
    replies = {
      normal: [
        {
          method: "answerCallbackQuery",
          params: {
            callback_query_id: cb.id,
            text: getDictionary(locale).errors["error.rateLimited"],
          },
        },
      ],
    };
  const result = await client.rpc("finish_telegram_update", {
    p_bot_id: bot,
    p_update_id: update.update_id,
    p_chat_id: valid ? chat!.id : null,
    p_tg_user_id: valid ? user!.id : null,
    p_locale: locale,
    p_replies: replies,
    p_action: action,
    p_booking_id: bookingId,
    p_web_user_id: actor,
    p_link_hash: linkHash,
  });
  if (result.error) throw new Error("Bot update transaction failed");
  return drainBotReplies(client, bot, update.update_id);
}
