import data from "../data/demo-content.json";

// Dedicated namespace for explicit sample content, never implicit live fallback.
export const demoId = (number: number) =>
  `d3e00000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const isDemoRecord = (id: string) =>
  id.startsWith("d3e00000-0000-4000-8000-");
export const stockImage = (slug: string) => `/images/stock/${slug}.jpg`;
export const stockPhotos = data.stockPhotos;
export const demoMenu = data.menu;
export const demoEvents = [
  ...data.events.map((event, index) => ({
    ...event,
    capacity: index === 0 ? 20 : index === 1 ? 3 : index === 2 ? 2 : 10,
    is_club_meeting: index === 0,
    seats_taken: index === 1 ? 2 : index === 2 ? 2 : 0,
  })),
  {
    ...data.events[0],
    id: demoId(105),
    date: "2026-11-28",
    title_ru: "Демо: свободная встреча",
    title_en: "Demo: open gathering",
    capacity: null,
    is_club_meeting: false,
    seats_taken: 0,
  },
];
export const demoGallery = data.gallery;
export const demoReviews = data.reviews;
