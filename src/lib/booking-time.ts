export const BOOKING_TIME_ZONE = "Asia/Bishkek";
export const BOOKING_OPEN_TIME = "10:00";
export const BOOKING_CLOSE_TIME = "22:00";
export const BOOKING_DURATION_MINUTES = 120;

export function addVenueDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function bookingSlots(date: string, now = new Date()) {
  return Array.from({ length: 24 }, (_, i) => {
    const minutes = 600 + i * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }).filter((time) => !bookingTimeError(date, time, now));
}

export function bookingEndTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const end = Math.min(22 * 60, hour * 60 + minute + BOOKING_DURATION_MINUTES);
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function venueToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: BOOKING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Bishkek is UTC+06:00 throughout the year. Inputs have already passed the Zod schema. */
export function bookingTimeError(date: string, time: string, now = new Date()) {
  const minute = time.slice(0, 5);
  if (minute < BOOKING_OPEN_TIME || minute >= BOOKING_CLOSE_TIME) return "validation.bookingHours" as const;
  const startsAt = new Date(`${date}T${time.length === 5 ? time + ":00" : time}+06:00`);
  if (startsAt.getTime() <= now.getTime()) return "validation.bookingPast" as const;
  return null;
}
