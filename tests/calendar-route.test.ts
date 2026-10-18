import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getEvent: vi.fn() }));
vi.mock("@/lib/content", () => ({ getEvent: mocks.getEvent, eventStartsAt: () => Date.parse("2026-11-01T13:00:00Z") }));
import { GET } from "@/app/api/events/[id]/calendar/route";
const id = "8f90c4f5-8fc1-4ae1-90d6-36cc1cb29768";
const context = { params: Promise.resolve({ id }) };
beforeEach(() => { vi.resetAllMocks(); mocks.getEvent.mockResolvedValue({ id, title_ru: "Встреча", title_en: "Reading night", description_ru: "Книги", description_en: "Books" }); });
it("downloads a localized file without a login or RSVP", async () => {
  const response = await GET(new Request("https://example.com/api/events/id/calendar?locale=en"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/calendar");
  expect(response.headers.get("content-disposition")).toContain(`${id}-en.ics`);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).toContain("SUMMARY:Reading night");
});
it("does not export a missing or unpublished event", async () => {
  mocks.getEvent.mockResolvedValue(undefined);
  expect((await GET(new Request("https://example.com/calendar"), context)).status).toBe(404);
});
it("rejects invalid identifiers before accessing content", async () => {
  expect((await GET(new Request("https://example.com/calendar"), { params: Promise.resolve({ id: "bad\r\nheader" }) })).status).toBe(404);
  expect(mocks.getEvent).not.toHaveBeenCalled();
});
it("reports a backend outage without downloading an empty calendar", async () => {
  mocks.getEvent.mockRejectedValue(new Error("offline"));
  const response = await GET(new Request("https://example.com/calendar"), context);
  expect(response.status).toBe(503);
  expect(response.headers.get("content-disposition")).toBeNull();
});
