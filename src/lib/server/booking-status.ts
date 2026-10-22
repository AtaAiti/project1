import type { createAdminClient } from "@/lib/supabase/admin";
import type { BookingRow } from "@/lib/telegram-bot";
export async function transitionBooking(
  client: ReturnType<typeof createAdminClient>,
  input: {
    id: string;
    status: string;
    expected: string;
    actor: string;
    source: "web" | "telegram";
  },
) {
  const { data, error } = await client.rpc("transition_booking_status", {
    p_id: input.id,
    p_status: input.status,
    p_expected: input.expected,
    p_actor: input.actor,
    p_source: input.source,
  });
  if (error || !data) throw new Error("Booking status unavailable");
  return data as {
    outcome: "changed" | "already" | "conflict" | "not_found" | "past";
    booking?: BookingRow;
  };
}
