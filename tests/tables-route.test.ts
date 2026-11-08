import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ available: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/server/table-availability", () => ({ availableTableIds: m.available }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rate, rateLimitKey: () => "tables:test" }));
import { GET } from "@/app/api/tables/route";
const request = (query = "date=2099-11-01&time=18:00&guests=2") => new Request(`http://localhost/api/tables?${query}`);
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test");
  m.available.mockReset(); m.rate.mockReset(); m.rate.mockResolvedValue({ allowed: true }); m.available.mockResolvedValue(["T1", "T3"]);
});
afterEach(() => vi.unstubAllEnvs());
it("returns only available table IDs and disables caching", async () => {
  const response = await GET(request());
  expect(await response.json()).toEqual({ available: ["T1", "T3"] });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(m.available).toHaveBeenCalledWith("2099-11-01", "18:00", 2);
});
it.each(["date=bad&time=18:00&guests=2", "date=2099-11-01&time=22:00&guests=2", "date=2099-11-01&time=18:00&guests=0", "date=2000-01-01&time=18:00&guests=2"])("rejects invalid visits before querying inventory", async (query) => {
  expect((await GET(request(query))).status).toBe(400); expect(m.available).not.toHaveBeenCalled();
});
it("fails closed when inventory is unavailable or rate limited", async () => {
  m.available.mockRejectedValue(new Error("Database down"));
  expect((await GET(request())).status).toBe(503);
  m.rate.mockResolvedValue({ allowed: false });
  expect((await GET(request())).status).toBe(429);
});
