import { describe, expect, it } from "vitest";
import { bookingTimeError, venueToday } from "@/lib/booking-time";
import { validateBookingInput } from "@/lib/booking-validation";
const now = new Date("2026-10-22T12:00:00Z"); // 18:00 in Bishkek.
const valid = { name: "Test", phone: "0700123456", date: "2026-10-22", time: "19:00", guests: 2 };

describe("booking times in Bishkek", () => {
  it.each(["09:59", "22:00", "22:00:01", "23:59", "00:00"])("rejects %s outside opening hours", (time) => {
    expect(validateBookingInput({ ...valid, date: "2026-10-23", time }, now)).toEqual({ errorKey: "validation.bookingHours" });
  });
  it.each(["10:00", "10:00:00", "21:59", "21:59:59"])("accepts %s on a future date", (time) => {
    expect(validateBookingInput({ ...valid, date: "2026-10-23", time }, now).data).toBeTruthy();
  });
  it("rejects an earlier date, an earlier time today and the exact current instant", () => {
    for (const input of [{ date: "2026-10-21", time: "19:00" }, { date: "2026-10-22", time: "17:59" }, { date: "2026-10-22", time: "18:00" }]) {
      expect(validateBookingInput({ ...valid, ...input }, now)).toEqual({ errorKey: "validation.bookingPast" });
    }
    expect(validateBookingInput({ ...valid, time: "18:01" }, now).data).toBeTruthy();
  });
  it("uses the venue day across UTC midnight instead of the visitor's local date", () => {
    expect(venueToday(new Date("2026-10-22T17:59:59Z"))).toBe("2026-10-22");
    expect(venueToday(new Date("2026-10-22T18:00:00Z"))).toBe("2026-10-23");
    expect(bookingTimeError("2026-10-23", "10:00", new Date("2026-10-23T03:59:00Z"))).toBeNull();
    expect(bookingTimeError("2026-10-23", "10:00", new Date("2026-10-23T04:00:00Z"))).toBe("validation.bookingPast");
  });
  it("keeps table capacity validation even when the time is valid", () => {
    expect(validateBookingInput({ ...valid, table_id: "T1", guests: 3 }, now)).toEqual({ errorKey: "validation.tableCapacity" });
    expect(validateBookingInput({ ...valid, table_id: "T6", guests: 6 }, now).data).toBeTruthy();
  });
});
