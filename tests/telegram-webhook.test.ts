import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const m = vi.hoisted(() => ({
  settings: vi.fn(),
  handle: vi.fn(),
  client: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: m.client }));
vi.mock("@/lib/server/telegram-bot/store", () => ({
  getBotSettings: m.settings,
  hashToken: (s: string) => createHash("sha256").update(s).digest("hex"),
}));
vi.mock("@/lib/server/telegram-bot/handler", () => ({
  handleBotUpdate: m.handle,
}));
import { POST } from "@/app/api/telegram/webhook/route";
const secret = "a".repeat(64),
  hash = createHash("sha256").update(secret).digest("hex");
const request = (body = '{"update_id":1}', token: string | null = secret) =>
  new Request("https://site/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-telegram-bot-api-secret-token": token } : {}),
    },
    body,
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.settings.mockResolvedValue({ bot_id: 10, secret_hash: hash });
  m.handle.mockResolvedValue(true);
});
it("rejects missing secret before accessing the DB", async () => {
  expect((await POST(request("{}", null))).status).toBe(401);
  expect(m.client).not.toHaveBeenCalled();
});
it("rejects wrong secret before parsing the update", async () => {
  expect((await POST(request("{}", "b".repeat(64)))).status).toBe(401);
  expect(m.handle).not.toHaveBeenCalled();
});
it("accepts only an unexpired previous secret during rotation", async () => {
  m.settings.mockResolvedValue({
    bot_id: 10,
    secret_hash: "b".repeat(64),
    previous_secret_hash: hash,
    previous_valid_until: "2099-01-01T00:00:00Z",
  });
  expect((await POST(request())).status).toBe(200);
  m.settings.mockResolvedValue({
    bot_id: 10,
    secret_hash: "b".repeat(64),
    previous_secret_hash: hash,
    previous_valid_until: "2000-01-01T00:00:00Z",
  });
  expect((await POST(request())).status).toBe(401);
});
it("rejects oversized bodies even without content-length and validates schema", async () => {
  expect((await POST(request(" ".repeat(65537)))).status).toBe(413);
  expect((await POST(request("{bad"))).status).toBe(400);
  expect((await POST(request("{}"))).status).toBe(400);
  expect(m.handle).not.toHaveBeenCalled();
});
it("returns 503 for unfinished delivery so Telegram retries", async () => {
  m.handle.mockResolvedValue(false);
  expect((await POST(request())).status).toBe(503);
});
it("acknowledges a processed update", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(m.handle).toHaveBeenCalledTimes(1);
});
