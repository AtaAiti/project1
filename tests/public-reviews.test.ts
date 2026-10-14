import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ insert: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: m.insert }) }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: m.rateLimit,
  rateLimitKey: () => "reviews:test",
}));
import { POST } from "@/app/api/reviews/route";
const body = {
    author: "Reader",
    rating: "4",
    text: "Wonderful evening",
    locale: "en",
  },
  request = (data: unknown) =>
    new Request("https://site.example/api/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test");
  m.insert.mockResolvedValue({ error: null });
  m.rateLimit.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.unstubAllEnvs());
it("always sends new public reviews to moderation", async () => {
  expect((await POST(request(body))).status).toBe(200);
  expect(m.insert).toHaveBeenCalledWith({
    author: "Reader",
    rating: 4,
    text_ru: body.text,
    text_en: body.text,
    status: "moderation",
  });
});
it("cannot self-publish through public input", async () => {
  expect((await POST(request({ ...body, status: "published" }))).status).toBe(
    400,
  );
  expect(m.insert).not.toHaveBeenCalled();
});
it.each([0, 6, 3.5, "no"])("rejects invalid rating %s", async (rating) => {
  const response = await POST(request({ ...body, rating }));
  expect(response.status).toBe(400);
  expect((await response.json()).errorKey).toBe("validation.rating");
});
it("honeypot succeeds without quota or insert", async () => {
  expect((await POST(request({ website: "spam" }))).status).toBe(200);
  expect(m.rateLimit).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});
it("blocks rate-limited submissions before writes", async () => {
  m.rateLimit.mockResolvedValue({ allowed: false });
  expect((await POST(request(body))).status).toBe(429);
  expect(m.insert).not.toHaveBeenCalled();
});
