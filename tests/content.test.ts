import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ order: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ order: mocks.order }) }),
  }),
}));
import {
  getMenu,
  getReviews,
  sortUpcoming,
  eventStartsAt,
} from "@/lib/content";
import { demoEvents, demoId, isDemoRecord } from "@/lib/demo-content";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  vi.resetAllMocks();
});
it("does not revive demo rows when a configured table is empty", async () => {
  mocks.order.mockResolvedValue({ data: [], error: null });
  expect(await getMenu()).toEqual([]);
});
it("surfaces an unavailable backend instead of silently serving made-up reviews", async () => {
  mocks.order.mockResolvedValue({
    data: null,
    error: { message: "unavailable" },
  });
  await expect(getReviews()).rejects.toThrow("temporarily unavailable");
});
it("sorts future events by Bishkek local time and excludes drafts/past events", () => {
  const now = Date.parse("2026-11-07T12:00:00Z");
  expect(eventStartsAt(demoEvents[0])).toBe(Date.parse("2026-11-07T13:00:00Z"));
  expect(
    sortUpcoming([...demoEvents].reverse(), now).map((row) => row.id),
  ).toEqual([demoId(101), demoId(102), demoId(103),demoId(105)]);
  expect(sortUpcoming([{ ...demoEvents[0], status: "draft" }], now)).toEqual(
    [],
  );
});
it("identifies the dedicated demo namespace", () => {
  expect(isDemoRecord(demoId(1))).toBe(true);
  expect(isDemoRecord("11111111-1111-4111-8111-111111111111")).toBe(false);
});
