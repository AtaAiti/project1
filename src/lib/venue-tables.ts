/** Demonstration floor plan. IDs remain stable because they are recorded in booking requests. */
export const VENUE_TABLES = [
  { id: "T1", seats: 2, zone: "window", x: 20, y: 24 },
  { id: "T2", seats: 2, zone: "window", x: 50, y: 24 },
  { id: "T3", seats: 4, zone: "window", x: 80, y: 24 },
  { id: "T4", seats: 4, zone: "library", x: 20, y: 48 },
  { id: "T5", seats: 4, zone: "hall", x: 80, y: 48 },
  { id: "T6", seats: 6, zone: "library", x: 20, y: 72 },
  { id: "T7", seats: 2, zone: "hall", x: 50, y: 72 },
  { id: "T8", seats: 6, zone: "bar", x: 80, y: 72 },
] as const;
export type VenueTable = (typeof VENUE_TABLES)[number];
export function findVenueTable(id: unknown): VenueTable | undefined {
  return VENUE_TABLES.find((table) => table.id === id);
}
