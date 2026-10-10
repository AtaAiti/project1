import { createClient } from "@/lib/supabase/server";

export const demoMenu = [
  { id: "demo-1", category: "Коктейли", name_ru: "Гэтсби", name_en: "Gatsby", composition_ru: "Золотой джин, шампанское, лаванда", composition_en: "Golden gin, champagne, lavender", strength: "12%", price: 890, is_hit: true },
  { id: "demo-2", category: "Коктейли", name_ru: "Анна Каренина", name_en: "Anna Karenina", composition_ru: "Бурбон, клюква, гранат", composition_en: "Bourbon, cranberry, pomegranate", strength: "15%", price: 950, is_hit: false },
  { id: "demo-3", category: "Безалкогольные", name_ru: "Безмолвная глава", name_en: "The Silent Chapter", composition_ru: "Чай, ягоды, сироп", composition_en: "Tea, berries, syrup", strength: "0%", price: 620, is_hit: false },
];
export const demoEvents = [{ id: "demo-event-1", date: "2026-10-02", time: "21:00", title_ru: "Виниловый джаз: Blue Note", title_en: "Vinyl Jazz: Blue Note", description_ru: "Тёплое звучание пластинок и авторские коктейли.", description_en: "Warm vinyl sound and signature cocktails.", status: "published", image_url: "" }];
export const demoGallery = [{ id: "demo-photo-1", image_url: "", caption_ru: "Весенний салон", caption_en: "Spring salon" }];
export const demoReviews = [{ id: "demo-review-1", author: "Марина Л.", rating: 5, text_ru: "Очень камерное место. Вечер получился особенным.", text_en: "A wonderfully intimate place. The evening was special.", status: "published" }];

async function query<T>(table: string, fallback: T[]): Promise<T[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return fallback;
  try { const supabase = await createClient(); const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false }); return error || !data?.length ? fallback : (data as T[]); } catch { return fallback; }
}
export const getMenu = () => query("menu_items", demoMenu);
export const getEvents = () => query("events", demoEvents);
export const getGallery = () => query("gallery_photos", demoGallery);
export const getReviews = () => query("reviews", demoReviews);
