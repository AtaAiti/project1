import { afterEach, expect, it, vi } from "vitest";
import { sendTelegram } from "@/lib/server/telegram";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("does not send without configuration", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  expect(await sendTelegram("test")).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["network", "http", "telegram"])("never throws a %s notification failure into the request", async (failure) => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token"); vi.stubEnv("TELEGRAM_CHAT_ID", "test-chat");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchMock = vi.fn().mockImplementation(async () => {
    if (failure === "network") throw new Error("sensitive URL containing test-token");
    return new Response(JSON.stringify({ ok: false }), { status: failure === "http" ? 500 : 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  expect(await sendTelegram("test")).toBe(false);
  expect(JSON.stringify(log.mock.calls)).not.toContain("test-token");
});

it("supports optional reply markup", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token"); vi.stubEnv("TELEGRAM_CHAT_ID", "test-chat");
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
  const markup = { inline_keyboard: [[{ text: "Test", callback_data: "test" }]] };
  expect(await sendTelegram("test", markup)).toBe(true);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_markup).toEqual(markup);
});
