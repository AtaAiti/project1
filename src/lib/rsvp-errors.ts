export const RPC_RSVP_ERRORS = {
  event_not_found: "rsvp.notFound",
  event_past: "rsvp.past",
  sold_out: "rsvp.soldOut",
  not_enough_seats: "rsvp.notEnoughSeats",
  duplicate: "rsvp.duplicate",
  invalid_input: "validation.invalid",
} as const;
export const RSVP_ERROR_KEYS = [
  "validation.required",
  "validation.phone",
  "validation.guests",
  "validation.invalid",
  "error.rateLimited",
  "error.generic",
  ...Object.values(RPC_RSVP_ERRORS),
] as const;
export function rsvpRpcError(message: string, code?: string) {
  if (code === "23505") return "rsvp.duplicate";
  if (Object.hasOwn(RPC_RSVP_ERRORS, message))
    return RPC_RSVP_ERRORS[message as keyof typeof RPC_RSVP_ERRORS];
  return "error.generic";
}
