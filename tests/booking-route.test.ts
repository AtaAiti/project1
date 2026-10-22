import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ru from "../dictionaries/ru.json";
import en from "../dictionaries/en.json";

const mocks = vi.hoisted(() => ({ rateLimit: vi.fn(), sendTelegram: vi.fn(), insert: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, rateLimitKey: () => "booking:test" }));
vi.mock("@/lib/server/telegram", () => ({ sendTelegram: mocks.sendTelegram }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: mocks.insert }) }) }));
import { POST } from "@/app/api/booking/route";

const valid = { name: "Test", phone: "0700123456", date: "2026-11-01", time: "19:00", guests: 2 };
const request = (body: unknown) => new Request("http://localhost/api/booking", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.sendTelegram.mockResolvedValue(false);
  mocks.single.mockResolvedValue({ data: { id: "test-id" }, error: null });
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("honeypot returns fake success without rate limit, database or Telegram", async () => {
  const response = await POST(request({ website: "spam" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.sendTelegram).not.toHaveBeenCalled();
  expect(mocks.rateLimit).not.toHaveBeenCalled();
});

it("saves a normalized pending booking and succeeds when notification is unavailable", async () => {
  const response = await POST(request(valid));
  expect(response.status).toBe(200);
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ phone: "+996700123456", status: "pending" }));
  expect(mocks.sendTelegram).toHaveBeenCalledOnce();
  expect(mocks.rateLimit).toHaveBeenCalledWith("booking:test", 5, 600);
});

it("blocks the rate-limited request before insert and notification", async () => {
  mocks.rateLimit.mockResolvedValue({ allowed: false });
  const response = await POST(request(valid));
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ errorKey: "error.rateLimited" });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.sendTelegram).not.toHaveBeenCalled();
});

describe("API error keys have translations in both languages", () => {
  it.each([
    [{}, "validation.required"],
    [{ ...valid, phone: "+79991234567" }, "validation.phone"],
    [{ ...valid, guests: 21 }, "validation.guests"],
    [{ ...valid, date: "2026-02-30" }, "validation.date"],
    [{ ...valid, time: "24:00" }, "validation.time"],
    [{ ...valid, unexpected: true }, "validation.invalid"],
  ])("emits a translated key for %j", async (body, key) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    const { errorKey } = await response.json();
    expect(errorKey).toBe(key);
    for (const dictionary of [ru, en]) expect(dictionary.errors[errorKey as keyof typeof dictionary.errors]).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("returns a localized generic error on RPC failure without writing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rateLimit.mockRejectedValue(new Error("RPC unavailable"));
    const response = await POST(request(valid));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ errorKey: "error.generic" });
    expect(ru.errors["error.generic"]).toBeTruthy();
    expect(en.errors["error.generic"]).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

it("persists the trusted table preference and includes it in Telegram", async () => {
  const response = await POST(request({ ...valid, table_id: "T1", comment: "By the window, please" }));
  expect(response.status).toBe(200);
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
    comment: expect.stringContaining("T1 (мест: 2"), status: "pending",
  }));
  expect(mocks.insert.mock.calls[0][0].comment).toContain("By the window, please");
  expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("table_id");
  expect(mocks.sendTelegram.mock.calls[0][0]).toContain("T1 (мест: 2");
});
it.each([
  [{ ...valid, table_id: "unknown" }, "validation.table"],
  [{ ...valid, table_id: "T1", guests: 3 }, "validation.tableCapacity"],
])("rejects invalid table requests before saving", async (body, key) => {
  const response = await POST(request(body));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ errorKey: key });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.sendTelegram).not.toHaveBeenCalled();
  for (const dictionary of [ru, en]) expect(dictionary.errors[key as keyof typeof dictionary.errors]).toBeTruthy();
});


it.each([
  [{ ...valid, date: "2026-10-21" }, "validation.bookingPast"],
  [{ ...valid, date: "2026-10-22", time: "17:59" }, "validation.bookingPast"],
  [{ ...valid, time: "09:59" }, "validation.bookingHours"],
  [{ ...valid, time: "22:00" }, "validation.bookingHours"],
])("rejects invalid booking times at the API before any write", async (body, key) => {
  const response = await POST(request(body));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ errorKey: key });
  expect(mocks.rateLimit).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.sendTelegram).not.toHaveBeenCalled();
  for (const dictionary of [ru, en]) expect(dictionary.errors[key as keyof typeof dictionary.errors]).toBeTruthy();
});
