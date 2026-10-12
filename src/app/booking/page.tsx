import { BookingClient } from "./booking-client";

export default async function BookingPage({ searchParams }: PageProps<"/booking">) {
  const params = await searchParams;
  return <BookingClient locale={params.locale === "en" ? "en" : "ru"} />;
}
