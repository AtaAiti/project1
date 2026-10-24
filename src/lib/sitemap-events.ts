import { createClient } from "@supabase/supabase-js";
import { demoEvents } from "@/lib/demo-content";
/** Public credentials only: drafts and guest registrations never enter the sitemap. */
export async function sitemapEvents(): Promise<Array<{ id: string }>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    return demoEvents
      .filter((event) => event.status === "published")
      .map(({ id }) => ({ id }));
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const events: Array<{ id: string }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("events")
      .select("id")
      .eq("status", "published")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("Published sitemap events unavailable");
    events.push(...data);
    if (data.length < 1000) return events;
  }
}
