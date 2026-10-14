import Link from "@/components/feedback-link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvent, eventStartsAt, hasContentBackend } from "@/lib/content";
import { getDictionary } from "@/lib/dictionaries";
import { ContentImage } from "@/components/content-image";
import { EventBadges } from "@/components/event-badges";
import { RsvpForm } from "@/components/rsvp-form";
import { stockImage } from "@/lib/demo-content";
type Props = { params: Promise<{ locale: string; id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: getDictionary(locale).rsvp.notFound };
  const title = locale === "en" ? event.title_en : event.title_ru,
    description = locale === "en" ? event.description_en : event.description_ru;
  return {
    metadataBase: new URL(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://literator-xi.vercel.app",
    ),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [event.image_url || stockImage("library")],
    },
  };
}
export default async function EventPage({ params }: Props) {
  const { locale, id } = await params;
  if (!["ru", "en"].includes(locale)) notFound();
  const event = await getEvent(id);
  if (!event) notFound();
  const d = getDictionary(locale),
    t = d.rsvp;
  const past = eventStartsAt(event) <= new Date().getTime();
  return (
    <main lang={locale} className="mx-auto max-w-6xl px-6 py-12">
      <Link href={`/${locale}/afisha`} className="text-[var(--gold)]">
        ← {t.back}
      </Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <article>
          <div className="relative aspect-[4/3]">
            <ContentImage
              src={event.image_url || stockImage("library")}
              alt={locale === "en" ? event.title_en : event.title_ru}
              sizes="(max-width:1024px) 100vw, 50vw"
              preload
            />
          </div>
          <h1 className="display mt-6 text-4xl">
            {locale === "en" ? event.title_en : event.title_ru}
          </h1>
          <p className="mt-4">
            {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ru-RU", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "Asia/Bishkek",
            }).format(new Date(eventStartsAt(event)))}{" "}
            · Asia/Bishkek
          </p>
          <EventBadges event={event} locale={locale} />
          <p className="mt-6 whitespace-pre-line text-[var(--text-secondary)]">
            {locale === "en" ? event.description_en : event.description_ru}
          </p>
        </article>
        <div>
          {past ? (
            <div className="card p-6">
              <p>{t.past}</p>
              {event.capacity !== null && (
                <p className="mt-4">
                  {t.seatsTaken}: {event.seats_taken} / {event.capacity}
                </p>
              )}
            </div>
          ) : (
            <RsvpForm
              eventId={event.id}
              capacity={event.capacity}
              seatsTaken={event.seats_taken}
              locale={locale}
              demo={!hasContentBackend()}
            />
          )}
        </div>
      </div>
    </main>
  );
}
