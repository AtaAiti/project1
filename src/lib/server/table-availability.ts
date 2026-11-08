import { createAdminClient } from "@/lib/supabase/admin";

export async function availableTableIds(date: string, time: string, guests: number, client = createAdminClient()) {
  const { data, error } = await client.rpc("available_venue_tables", {
    p_date: date, p_time: time, p_guests: guests,
  });
  if (error) throw new Error("Table availability unavailable");
  return (data ?? []).map((row: { id: string }) => row.id);
}
