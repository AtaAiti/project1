import type { BookingErrorKey } from "@/lib/booking-errors";

export type BookingPayload = {
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  comment: string;
};

type ValidationResult =
  | { data: BookingPayload; errorKey?: never }
  | { data?: never; errorKey: BookingErrorKey };

export function validateBookingInput(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") return { errorKey: "validation.required" };

  const values = input as Record<string, unknown>;
  const name = String(values.name ?? "").trim();
  const phone = String(values.phone ?? "").trim();
  const date = String(values.date ?? "").trim();
  const time = String(values.time ?? "").trim();
  const guestsText = String(values.guests ?? "").trim();
  const guests = Number(guestsText);
  const comment = String(values.comment ?? "").trim();

  if (!name || !phone || !date || !time || !guestsText) return { errorKey: "validation.required" };
  if (phone.replace(/\D/g, "").length < 11) return { errorKey: "validation.phone" };
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) return { errorKey: "validation.guests" };

  return { data: { name, phone, date, time, guests, comment } };
}
