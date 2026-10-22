export const BOOKING_TIME_ZONE = "Asia/Bishkek";
export const BOOKING_OPEN_TIME = "10:00";
export const BOOKING_CLOSE_TIME = "22:00";

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
