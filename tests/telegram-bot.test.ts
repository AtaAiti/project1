import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  parseBotCommand,
  telegramText,
  telegramUpdateSchema,
  bookingActions,
} from "@/lib/telegram-bot";
const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  drain: vi.fn(),
  allowed: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/server/telegram-bot/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/telegram-bot/store")>()),
  getBotActor: mocks.actor,
  drainBotReplies: mocks.drain,
  webAdminStillAllowed: mocks.allowed,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rate }));
import { handleBotUpdate } from "@/lib/server/telegram-bot/handler";
import type { BotClient } from "@/lib/server/telegram-bot/store";
const id = "11111111-1111-4111-8111-111111111111",
  actor = "22222222-2222-4222-8222-222222222222";
const settings = {
  bot_id: 10,
  username: "TestBot",
  secret_hash: "a".repeat(64),
  previous_secret_hash: null,
  previous_valid_until: null,
};
let tables: Record<string, unknown>, rpc: ReturnType<typeof vi.fn>;
function client() {
  return {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: tables[table] ?? null, error: null }),
      };
      return chain;
    },
    rpc,
  } as unknown as BotClient;
}
const message = (text: string) => ({
  update_id: 1,
  message: {
    message_id: 1,
    chat: { id: 20, type: "private" as const },
    from: { id: 20, language_code: "ru" },
    text,
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  tables = {};
  rpc = vi.fn().mockResolvedValue({
    data: { duplicate: false, outcome: "normal" },
    error: null,
  });
  mocks.actor.mockResolvedValue(null);
  mocks.allowed.mockResolvedValue(true);
  mocks.drain.mockResolvedValue(true);
  mocks.rate.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.useRealTimers());
it("parses addressed commands but ignores another bot", () => {
  expect(parseBotCommand("/BOOKING@TestBot  abc", "testbot")).toEqual({
    name: "booking",
    argument: "abc",
  });
  expect(parseBotCommand("/pending@OtherBot", "testbot")).toBeNull();
});
it("fits Unicode messages and callbacks in Telegram limits", () => {
  const text = telegramText("😀".repeat(3000));
  expect(text.length).toBeLessThan(4096);
  expect(text).not.toMatch(/[\uD800-\uDBFF]…$/);
  for (const row of bookingActions(id).inline_keyboard)
    for (const button of row)
      if ("callback_data" in button)
        expect(Buffer.byteLength(button.callback_data!)).toBeLessThanOrEqual(
          64,
        );
});
it("accepts real extra Telegram fields but rejects unsafe IDs", () => {
  expect(
    telegramUpdateSchema.safeParse({ ...message("/help"), extra: true })
      .success,
  ).toBe(true);
  expect(
    telegramUpdateSchema.safeParse({
      ...message("/help"),
      update_id: Number.MAX_SAFE_INTEGER + 1,
    }).success,
  ).toBe(false);
});
it("deduplicates before preparing or rate-limiting a replay", async () => {
  tables.telegram_updates = { update_id: 1 };
  await handleBotUpdate(client(), settings, message("/confirm " + id));
  expect(rpc).not.toHaveBeenCalled();
  expect(mocks.actor).not.toHaveBeenCalled();
  expect(mocks.drain).toHaveBeenCalledWith(expect.anything(), 10, 1);
});
it("denies private booking commands without querying guest data", async () => {
  await handleBotUpdate(client(), settings, message("/booking " + id));
  const args = rpc.mock.calls[0][1];
  expect(args.p_action).toBe("none");
  expect(JSON.stringify(args.p_replies)).toContain(
    "только подключённому администратору",
  );
});
it("ignores group updates even for a bound administrator", async () => {
  const update = message("/pending");
  update.message.chat = { id: -20, type: "group" as "private" };
  await handleBotUpdate(client(), settings, update);
  expect(mocks.actor).not.toHaveBeenCalled();
  expect(rpc.mock.calls[0][1].p_replies).toEqual({ normal: [] });
});
it("displays a booking and requires a separate decline confirmation", async () => {
  mocks.actor.mockResolvedValue(actor);
  tables.bookings = {
    id,
    name: "Guest",
    phone: "+996700000000",
    date: "2099-11-01",
    time: "19:00:00",
    guests: 2,
    comment: "Test",
    status: "pending",
  };
  await handleBotUpdate(client(), settings, message("/decline " + id));
  const args = rpc.mock.calls[0][1];
  expect(args.p_action).toBe("none");
  expect(JSON.stringify(args.p_replies)).toContain("b:reject:" + id);
  expect(args.p_replies.normal[0].admin_user_id).toBe(actor);
});
it("commits authenticated callbacks through the atomic RPC and always answers them", async () => {
  mocks.actor.mockResolvedValue(actor);
  tables.bookings = {
    id,
    name: "Guest",
    phone: "+996700000000",
    date: "2099-11-01",
    time: "19:00:00",
    guests: 2,
    comment: "",
    status: "pending",
  };
  const m = message("");
  await handleBotUpdate(client(), settings, {
    update_id: 2,
    callback_query: {
      id: "callback",
      from: m.message.from,
      message: m.message,
      data: "b:confirm:" + id,
    },
  });
  const args = rpc.mock.calls[0][1];
  expect(args).toMatchObject({
    p_action: "confirm",
    p_booking_id: id,
    p_web_user_id: actor,
  });
  for (const outcome of ["changed", "already", "conflict", "past", "not_found"])
    expect(args.p_replies[outcome][0].method).toBe("answerCallbackQuery");
});
it("rejects expired pairing tokens without binding", async () => {
  tables.telegram_link_tokens = {
    web_user_id: actor,
    expires_at: "2000-01-01T00:00:00Z",
  };
  await handleBotUpdate(
    client(),
    settings,
    message("/start link_" + "a".repeat(43)),
  );
  expect(rpc.mock.calls[0][1].p_action).toBe("none");
  expect(JSON.stringify(rpc.mock.calls[0][1].p_replies)).toContain("истекла");
});
it("hashes pairing secrets and verifies current web rights", async () => {
  tables.telegram_link_tokens = {
    web_user_id: actor,
    expires_at: "2099-01-01T00:00:00Z",
  };
  await handleBotUpdate(
    client(),
    settings,
    message("/start link_" + "a".repeat(43)),
  );
  const args = rpc.mock.calls[0][1];
  expect(args.p_action).toBe("link");
  expect(args.p_link_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(mocks.allowed).toHaveBeenCalledWith(expect.anything(), actor);
  expect(JSON.stringify(args)).not.toContain("link_" + "a".repeat(43));
});
it("returns failure when the DB transaction fails rather than acknowledging it", async () => {
  rpc.mockResolvedValue({ error: { message: "unavailable" } });
  await expect(
    handleBotUpdate(client(), settings, message("/help")),
  ).rejects.toThrow();
  expect(mocks.drain).not.toHaveBeenCalled();
});

it("links directly to the localized booking form and contacts WhatsApp", async () => {
  await handleBotUpdate(client(), settings, message("/book"));
  expect(JSON.stringify(rpc.mock.calls[0][1].p_replies)).toContain(
    "/booking?locale=ru",
  );
  rpc.mockClear();
  await handleBotUpdate(client(), settings, message("/contacts"));
  expect(JSON.stringify(rpc.mock.calls[0][1].p_replies)).toContain(
    "https://wa.me/996779118824",
  );
});
