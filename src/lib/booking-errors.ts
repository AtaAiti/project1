export const BOOKING_ERROR_KEYS = [
  "validation.required",
  "validation.phone",
  "validation.guests",
  "error.rateLimited",
  "error.generic",
] as const;

export type BookingErrorKey = (typeof BOOKING_ERROR_KEYS)[number];

export function isBookingErrorKey(value: unknown): value is BookingErrorKey {
  return typeof value === "string" && BOOKING_ERROR_KEYS.includes(value as BookingErrorKey);
}
