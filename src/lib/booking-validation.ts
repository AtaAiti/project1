import type { BookingErrorKey } from "@/lib/booking-errors";
import { isBookingErrorKey } from "@/lib/booking-errors";
import { bookingSchema } from "@/lib/schemas";

export type BookingPayload = {
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  comment: string;
  website?: string;
};

type ValidationResult =
  | { data: BookingPayload; errorKey?: never }
  | { data?: never; errorKey: BookingErrorKey };

export function validateBookingInput(input: unknown): ValidationResult {
  const result = bookingSchema.safeParse(input);
  if (result.success) return { data: result.data };
  const issue = result.error.issues[0];
  if (issue.path[0] === "guests") return { errorKey: "validation.guests" };
  return { errorKey: isBookingErrorKey(issue.message) ? issue.message : "validation.invalid" };
}
