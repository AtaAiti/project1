import { findVenueTable } from "@/lib/venue-tables";
import { BookingClient } from "./booking-client";

export default async function BookingPage({ searchParams }: PageProps<"/booking">) {
  const params = await searchParams;
  return <BookingClient locale={params.locale === "en" ? "en" : "ru"} tableId={findVenueTable(params.table)?.id} invalidTable={params.table !== undefined && !findVenueTable(params.table)} />;
}
