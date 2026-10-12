import data from "../data/demo-content.json";

// Dedicated namespace for explicit sample content, never implicit live fallback.
export const demoId = (number: number) =>
  `d3e00000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const isDemoRecord = (id: string) =>
  id.startsWith("d3e00000-0000-4000-8000-");
export const stockImage = (slug: string) => `/images/stock/${slug}.jpg`;
export const stockPhotos = data.stockPhotos;
export const demoMenu = data.menu;
export const demoEvents = data.events;
export const demoGallery = data.gallery;
export const demoReviews = data.reviews;
