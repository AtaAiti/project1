import { describe, expect, it } from "vitest";
import { createCalendar } from "@/lib/calendar";

const event = {
  id: "8f90c4f5-8fc1-4ae1-90d6-36cc1cb29768",
  title: "Встреча, книги; чай",
  description: "Первая строка\r\nВторая строка",
  location: "Бишкек",
  startsAt: new Date("2026-11-01T19:00:00+06:00"),
  url: "https://literator-xi.vercel.app/ru/afisha/8f90c4f5-8fc1-4ae1-90d6-36cc1cb29768",
};
const now = new Date("2026-10-18T10:00:00Z");

describe("calendar export", () => {
  it("exports the correct UTC instant for Bishkek without inventing an end time", () => {
    const ics = createCalendar(event, now).replace(/\r\n /g, "");
    expect(ics).toContain("DTSTART:20261101T130000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261018T100000Z\r\n");
    expect(ics).not.toContain("DTEND");
    expect(ics).toContain(`UID:${event.id}@literator\r\n`);
    expect(ics).toContain("SUMMARY:Встреча\\, книги\\; чай\r\n");
    expect(ics).toContain("DESCRIPTION:Первая строка\\nВторая строка\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("folds Cyrillic and emoji by UTF-8 bytes and preserves the original content", () => {
    const title = "Книжный вечер 📖 ".repeat(30);
    const ics = createCalendar({ ...event, title }, now);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${title}\r\n`);
  });
  it("escapes line breaks so text cannot inject calendar properties", () => {
    const ics = createCalendar({ ...event, title: "Title\r\nATTENDEE:mailto:bad@example.com", description: "a\\b,c;d" }, now);
    expect(ics).not.toMatch(/\r\nATTENDEE:/);
    expect(ics.replace(/\r\n /g, "")).toContain("DESCRIPTION:a\\\\b\\,c\\;d");
  });
});
