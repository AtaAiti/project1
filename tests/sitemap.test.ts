import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ range: vi.fn(), eq: vi.fn(), client: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: m.client }));
import sitemap from "@/app/sitemap";
import { sitemapEvents } from "@/lib/sitemap-events";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  const q = { select: () => q, eq: m.eq, order: () => q, range: m.range };
  m.eq.mockReturnValue(q);
  m.client.mockReturnValue({ from: () => q });
  m.range.mockResolvedValue({ data: [{ id }], error: null });
});
it("lists public pages and published events in both languages with matching hreflang", async () => {
  const entries = await sitemap();
  expect(m.eq).toHaveBeenCalledWith("status", "published");
  expect(entries).toHaveLength(16);
  expect(entries.filter((e) => e.url.includes(id))).toHaveLength(2);
  for (const row of entries) {
    expect(row.url).not.toMatch(/admin|api\/|styleguide|table=/);
    expect(row.alternates?.languages).toHaveProperty("ru");
    expect(row.alternates?.languages).toHaveProperty("en");
  }
});
it("paginates beyond the Supabase default row limit", async () => {
  m.range
    .mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })),
      error: null,
    })
    .mockResolvedValueOnce({ data: [{ id }], error: null });
  expect(await sitemapEvents()).toHaveLength(1001);
  expect(m.range).toHaveBeenNthCalledWith(2, 1000, 1999);
});
it("does not replace a failed live query with invented demo URLs", async () => {
  m.range.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  await expect(sitemap()).rejects.toThrow(
    "Published sitemap events unavailable",
  );
});
it("keeps a deliberately empty live table empty", async () => {
  m.range.mockResolvedValue({ data: [], error: null });
  expect(await sitemap()).toHaveLength(14);
});
