import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ reset: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail: m.reset } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: m.rateLimit,
  rateLimitKey: () => "reset:test",
}));
import { POST } from "@/app/api/auth/reset-password/route";
const request = (
  email = "reader@example.com",
  origin = "https://site.example",
) =>
  new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { origin, host: "site.example", "x-forwarded-proto": "https" },
    body: JSON.stringify({ email }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.reset.mockResolvedValue({ error: null });
  m.rateLimit.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.restoreAllMocks());
it("uses the public origin for PKCE recovery and normalizes email", async () => {
  expect((await POST(request(" Reader@Example.com "))).status).toBe(200);
  expect(m.reset).toHaveBeenCalledWith("reader@example.com", {
    redirectTo: "https://site.example/admin/reset-password",
  });
});
it("rejects cross-origin reset attempts", async () => {
  expect(
    (await POST(request("reader@example.com", "https://other.example"))).status,
  ).toBe(403);
  expect(m.reset).not.toHaveBeenCalled();
});
it("validates email before consuming quota", async () => {
  expect((await POST(request("bad"))).status).toBe(400);
  expect(m.rateLimit).not.toHaveBeenCalled();
});
it("does not send when quota is exhausted", async () => {
  m.rateLimit.mockResolvedValue({ allowed: false });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("3600");
  expect(m.reset).not.toHaveBeenCalled();
});
it("reports provider email limits instead of claiming success", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.reset.mockResolvedValue({
    error: { status: 429, code: "over_email_send_rate_limit" },
  });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect((await response.json()).errorKey).toBe("error.emailRateLimited");
});
it("reports provider delivery errors", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.reset.mockResolvedValue({
    error: { status: 403, code: "email_address_not_authorized" },
  });
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect((await response.json()).errorKey).toBe("error.emailDelivery");
});
