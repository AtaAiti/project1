import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ call: vi.fn(), allowed: vi.fn() }));
vi.mock("@/lib/server/telegram", () => ({ telegramCall: m.call }));
vi.mock("@/lib/server/admin-access", () => ({ isAllowedAdminUser: m.allowed }));
import { drainBotReplies } from "@/lib/server/telegram-bot/store";
import type { BotClient } from "@/lib/server/telegram-bot/store";
const actor = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  m.call.mockResolvedValue({ ok: true, permanent: false, retryAfter: 0 });
  m.allowed.mockResolvedValue(true);
});
function setup(privateJob = false) {
  const job = {
    id: "job",
    lease_token: "lease",
    job: {
      method: "sendMessage",
      params: { chat_id: 20, text: "Private guest" },
      ...(privateJob ? { admin_user_id: actor, admin_telegram_id: 20 } : {}),
    },
  };
  const claim = vi
    .fn()
    .mockResolvedValueOnce({ data: [job], error: null })
    .mockResolvedValue({ data: [], error: null });
  const ack = vi.fn().mockResolvedValue({ data: true, error: null });
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: async () => ({ data: { web_user_id: actor }, error: null }),
    then: (resolve: (r: unknown) => void) => resolve({ count: 0, error: null }),
  };
  const client = {
    from: () => chain,
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { id: actor } },
          error: null,
        }),
      },
    },
    rpc: (name: string, args: unknown) =>
      name === "claim_telegram_delivery" ? claim(args) : ack(args),
  } as unknown as BotClient;
  return { client, ack, claim };
}
it("retries temporary delivery without replaying the domain transition", async () => {
  const { client, ack } = setup();
  m.call.mockResolvedValue({ ok: false, permanent: false, retryAfter: 45 });
  expect(await drainBotReplies(client, 10, 1)).toBe(false);
  expect(ack).toHaveBeenCalledWith(
    expect.objectContaining({
      p_success: false,
      p_permanent: false,
      p_retry_after: 45,
    }),
  );
});
it("refuses to deliver queued guest data after web rights are revoked", async () => {
  const { client, ack } = setup(true);
  m.allowed.mockResolvedValue(false);
  expect(await drainBotReplies(client, 10, 1)).toBe(true);
  expect(m.call).not.toHaveBeenCalled();
  expect(ack).toHaveBeenCalledWith(
    expect.objectContaining({ p_permanent: true, p_success: false }),
  );
});
it("delivers a private response only after rechecking current rights", async () => {
  const { client, ack } = setup(true);
  expect(await drainBotReplies(client, 10, 1)).toBe(true);
  expect(m.allowed).toHaveBeenCalled();
  expect(m.call).toHaveBeenCalledWith("sendMessage", {
    chat_id: 20,
    text: "Private guest",
  });
  expect(ack).toHaveBeenCalledWith(
    expect.objectContaining({ p_success: true }),
  );
});
