import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { rsvpSchema } from "@/lib/schemas";
import { RSVP_ERROR_KEYS, RPC_RSVP_ERRORS } from "@/lib/rsvp-errors";
import ru from "../dictionaries/ru.json";
import en from "../dictionaries/en.json";
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  rateLimit: vi.fn(),
  sendTelegram: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: m.rateLimit,
  rateLimitKey: () => "rsvp:test",
}));
vi.mock("@/lib/server/telegram", () => ({ sendTelegram: m.sendTelegram }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: m.rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: m.single }) }) }),
  }),
}));
import { POST } from "@/app/api/rsvp/route";
const valid = {
  event_id: "d4e00000-0000-4000-8000-000000000001",
  name: "Reader",
  phone: "0700123456",
  guests: 2,
};
const request = (body: unknown) =>
  new Request("https://site.example/api/rsvp", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test");
  m.rateLimit.mockResolvedValue({ allowed: true });
  m.rpc.mockResolvedValue({
    data: [{ id: "new-id", seats_left: 3 }],
    error: null,
  });
  m.single.mockResolvedValue({
    data: { title_ru: "Test event", date: "2026-11-01", time: "19:00" },
  });
  m.sendTelegram.mockResolvedValue(false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("normalizes a valid phone and inserts only through the capacity RPC", async () => {
  const response = await POST(request(valid));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, seatsLeft: 3 });
  expect(m.rpc).toHaveBeenCalledWith("create_event_rsvp", {
    p_event_id: valid.event_id,
    p_name: "Reader",
    p_phone: "+996700123456",
    p_guests: 2,
  });
  expect(m.sendTelegram).toHaveBeenCalledOnce();
});
it.each([0, 7, 1.5, "abc"])(
  "rejects invalid guest count %s",
  async (guests) => {
    expect(rsvpSchema.safeParse({ ...valid, guests }).success).toBe(false);
    const response = await POST(request({ ...valid, guests }));
    expect(response.status).toBe(400);
    expect((await response.json()).errorKey).toBe("validation.guests");
    expect(m.rpc).not.toHaveBeenCalled();
  },
);
it("rejects invalid event IDs, foreign phones, missing names and unknown fields", () => {
  for (const body of [
    { ...valid, event_id: "bad" },
    { ...valid, phone: "+79991234567" },
    { ...valid, name: " " },
    { ...valid, role: "admin" },
  ])
    expect(rsvpSchema.safeParse(body).success).toBe(false);
});
it("honeypot produces fake success with no effects", async () => {
  const response = await POST(request({ website: "spam" }));
  expect(await response.json()).toEqual({ ok: true, seatsLeft: null });
  expect(m.rateLimit).not.toHaveBeenCalled();
  expect(m.rpc).not.toHaveBeenCalled();
  expect(m.sendTelegram).not.toHaveBeenCalled();
});
it("blocks the sixth rate-limited submission before writing", async () => {
  m.rateLimit.mockResolvedValue({ allowed: false });
  expect((await POST(request(valid))).status).toBe(429);
  expect(m.rpc).not.toHaveBeenCalled();
});
it.each(Object.entries(RPC_RSVP_ERRORS))(
  "maps %s to translated key %s",
  async (message, key) => {
    m.rpc.mockResolvedValue({ data: null, error: { message, code: "P0001" } });
    const response = await POST(request(valid));
    expect((await response.json()).errorKey).toBe(key);
    expect(m.sendTelegram).not.toHaveBeenCalled();
  },
);
it("does not report a saved registration as failed when notification lookup fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.single.mockRejectedValue(new Error("offline"));
  expect((await POST(request(valid))).status).toBe(200);
});
it("all RSVP error keys exist in both dictionaries", () => {
  for (const key of RSVP_ERROR_KEYS)
    for (const d of [ru, en]) expect(d.errors[key]).toBeTruthy();
});
