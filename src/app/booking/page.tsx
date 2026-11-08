import { localizedMetadata } from "@/lib/site-seo";
import { findVenueTable } from "@/lib/venue-tables";
import { BookingClient } from "./booking-client";
import { RestoreBookingVisit } from "@/components/booking-draft";

export async function generateMetadata({
  searchParams,
}: PageProps<"/booking">) {
  const p = await searchParams;
  return localizedMetadata(p.locale === "en" ? "en" : "ru", "booking");
}

export default async function BookingPage({
  searchParams,
}: PageProps<"/booking">) {
  const params = await searchParams;
  return (
    <>
    <RestoreBookingVisit query={params} />
    <BookingClient
      locale={params.locale === "en" ? "en" : "ru"}
      tableId={findVenueTable(params.table)?.id}
      invalidTable={params.table !== undefined && !findVenueTable(params.table)}
    />
    </>
  );
}
