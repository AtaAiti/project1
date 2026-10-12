import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  demoMenu,
  demoEvents,
  demoGallery,
  demoReviews,
  stockImage,
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
export const getEvents = cache(() => query<EventItem>("events", demoEvents));
export const getGallery = cache(() =>
  query<GalleryPhoto>("gallery_photos", demoGallery),
);
export const getReviews = cache(() => query<Review>("reviews", demoReviews));

export function menuImage(item: MenuItem) {
  if (item.category === "Десерты") return stockImage("dessert");
  if (item.category === "Горячее") return stockImage("pasta");
  if (item.category === "Закуски") return stockImage("salad");
  if (["Кофе", "Чай", "Безалкогольные"].includes(item.category))
    return stockImage("coffee");
  return stockImage("cocktails");
}

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
