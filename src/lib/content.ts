import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  demoMenu,
  demoEvents,
  demoGallery,
  demoReviews,
} from "@/lib/demo-content";
export {
  demoMenu,
  demoEvents,
  demoGallery,
  demoReviews,
} from "@/lib/demo-content";

export type MenuItem = (typeof demoMenu)[number] & { created_at?: string };
export type EventItem = (typeof demoEvents)[number] & { created_at?: string };
export type GalleryPhoto = (typeof demoGallery)[number] & {
  created_at?: string;
};
export type Review = (typeof demoReviews)[number] & { created_at?: string };

export const hasContentBackend = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

async function query<T>(table: string, fallback: T[]): Promise<T[]> {
  if (!hasContentBackend()) return fallback;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Public content is temporarily unavailable.");
  // An empty live table remains empty: deleted content must not reappear as demo data.
  return (data ?? []) as T[];
}
export const getMenu = cache(() => query<MenuItem>("menu_items", demoMenu));
export const getEvents = cache(async () => {
  if (!hasContentBackend()) return demoEvents;
  const events = await query<EventItem>("events", []);
  const client = await createClient();
  const { data, error } = await client
    .from("event_seats")
    .select("event_id,seats_taken");
  if (error)
    throw new Error(
      "Event seat counts are unavailable. Apply the RSVP migration.",
    );
  const seats = new Map(
    (data || []).map((row) => [row.event_id, Number(row.seats_taken)]),
  );
  return events.map((event) => ({
    ...event,
    capacity: event.capacity ?? null,
    is_club_meeting: event.is_club_meeting ?? false,
    seats_taken: seats.get(event.id) ?? 0,
  }));
});
export const getEvent = cache(async (id: string) =>
  (await getEvents()).find(
    (event) => event.id === id && event.status === "published",
  ),
);
export const getGallery = cache(() =>
  query<GalleryPhoto>("gallery_photos", demoGallery),
);
export const getReviews = cache(() => query<Review>("reviews", demoReviews));

export { menuImage } from "@/lib/menu-presentation";

export function eventStartsAt(event: Pick<EventItem, "date" | "time">) {
  return new Date(
    `${event.date}T${event.time.length === 5 ? event.time + ":00" : event.time}+06:00`,
  ).getTime();
}
export function sortUpcoming(events: EventItem[], now = Date.now()) {
  return events
    .filter(
      (event) => event.status === "published" && eventStartsAt(event) >= now,
    )
    .sort((a, b) => eventStartsAt(a) - eventStartsAt(b));
}
