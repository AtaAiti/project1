import type { BookingErrorKey } from "@/lib/booking-errors";
import { isBookingErrorKey } from "@/lib/booking-errors";
import { bookingSchema } from "@/lib/schemas";
import { bookingTimeError } from "@/lib/booking-time";

export type BookingPayload = {
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  comment: string;
  website?: string;
  table_id?: string;
};

type ValidationResult =
  | { data: BookingPayload; errorKey?: never }
  | { data?: never; errorKey: BookingErrorKey };

export function validateBookingInput(input: unknown, now = new Date()): ValidationResult {
  const result = bookingSchema.safeParse(input);
  if (result.success) {
    const errorKey = bookingTimeError(result.data.date, result.data.time, now);
    return errorKey ? { errorKey } : { data: result.data };
  }
  const issue = result.error.issues[0];
  if (issue.path[0] === "guests") return { errorKey: "validation.guests" };
  return { errorKey: isBookingErrorKey(issue.message) ? issue.message : "validation.invalid" };
}
