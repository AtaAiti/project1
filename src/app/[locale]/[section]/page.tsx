import { localizedMetadata } from "@/lib/site-seo";
import Link from "@/components/feedback-link";
import { EventBadges } from "@/components/event-badges";
import { notFound } from "next/navigation";
import { ContactMap } from "@/components/contact-map";
import { BookingForm } from "@/components/booking-form";
import { MenuCatalog } from "@/components/menu-catalog";
import { ReviewForm } from "@/components/review-form";
import { getDictionary } from "@/lib/dictionaries";
import {
  getEvents,
  getGallery,
  getMenu,
  getReviews,
  sortUpcoming,
  eventStartsAt,
  hasContentBackend,
} from "@/lib/content";
import { isDemoRecord, stockImage } from "@/lib/demo-content";
import { ContentImage } from "@/components/content-image";
import { Gallery } from "@/components/gallery";
import { DemoNotice } from "@/components/demo-notice";

const sections = ["about", "menu", "afisha", "contacts"];
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[section]">) {
  const { locale, section } = await params;
  if (!sections.includes(section))
    return { robots: { index: false, follow: false } };
  return localizedMetadata(
    locale === "en" ? "en" : "ru",
    section as "about" | "menu" | "afisha" | "contacts",
  );
}

export default async function SectionPage({
  params,
}: PageProps<"/[locale]/[section]">) {
  const { locale, section } = await params;
  if (!sections.includes(section)) notFound();
  const d = getDictionary(locale);
  const t = d.publicUi;
  const en = locale === "en";
  if (section === "menu") {
    const items = await getMenu();
    return (
      <main>
        {(!hasContentBackend() ||
          items.some((item) => isDemoRecord(item.id))) && (
          <DemoNotice locale={locale} />
        )}
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="section-label">{d.nav.menu}</p>
          <h1 className="display mt-5 text-5xl">{t.menuTitle}</h1>
          <p className="mt-5 max-w-2xl leading-7 text-[var(--text-secondary)]">
            {d.experience.menuIntro}
          </p>
          <MenuCatalog items={items} locale={locale} />
          <p className="mt-10 text-xs text-[var(--text-secondary)]">
            {t.stockNote}
          </p>
        </div>
      </main>
    );
  }
  if (section === "afisha") {
    const events = (await getEvents()).filter(
      (event) => event.status === "published",
    );
    const future = sortUpcoming(events);
    const futureIds = new Set(future.map((event) => event.id));
    const past = events
      .filter((event) => !futureIds.has(event.id))
      .sort((a, b) => eventStartsAt(b) - eventStartsAt(a));
    const cards = (list: typeof events) => (
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {list.map((event) => (
          <article key={event.id} className="card overflow-hidden">
            <div className="relative aspect-[16/9]">
              <ContentImage
                src={event.image_url || stockImage("library")}
                alt={en ? event.title_en : event.title_ru}
                sizes="(max-width:768px) 100vw, 50vw"
              />
            </div>
            <div className="p-6">
              <p className="text-sm text-[var(--gold)]">
                {event.date} · {event.time.slice(0, 5)} · Asia/Bishkek
              </p>
              <h3 className="display mt-4 text-3xl">
                <Link href={`/${locale}/afisha/${event.id}`}>
                  {en ? event.title_en : event.title_ru}
                </Link>
              </h3>
              <EventBadges event={event} locale={locale} />
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                {en ? event.description_en : event.description_ru}
              </p>
              {futureIds.has(event.id) && (
                <>
                  <Link
                    href={`/${locale}/afisha/${event.id}`}
                    className="btn-outline-gold mt-6 inline-block"
                  >
                    {d.rsvp.details}
                  </Link>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    );
    return (
      <main>
        {events.some((event) => isDemoRecord(event.id)) && (
          <DemoNotice locale={locale} />
        )}
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="section-label">{d.nav.afisha}</p>
          <h1 className="display mt-5 text-5xl">{t.programme}</h1>
          {future.length ? (
            cards(future)
          ) : (
            <p className="card mt-10 p-8">{t.emptyEvents}</p>
          )}
          {past.length > 0 && (
            <section className="mt-16">
              <h2 className="display text-3xl">{t.archive}</h2>
              {cards(past)}
            </section>
          )}
        </div>
      </main>
    );
  }
  if (section === "contacts")
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="section-label">{d.nav.contacts}</p>
        <h1 className="display mt-5 text-5xl">{t.contacts}</h1>
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <div>
            <p>{t.address}</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t.addressNote}
            </p>
            <p className="mt-6">{t.hours}</p>
            <a className="mt-5 block" href="tel:+996779118824">
              {t.phone}
            </a>
            <a
              className="btn-outline-gold mt-6 inline-block"
              href="https://wa.me/996779118824"
            >
              {t.whatsapp}
            </a>
            <ContactMap locale={locale} />
          </div>
          <BookingForm locale={locale} />
        </div>
      </main>
    );
  const [gallery, reviews] = await Promise.all([getGallery(), getReviews()]);
  return (
    <main>
      {[...gallery, ...reviews].some((row) => isDemoRecord(row.id)) && (
        <DemoNotice locale={locale} />
      )}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="section-label">{d.nav.about}</p>
        <h1 className="display mt-5 text-5xl">{t.aboutTitle}</h1>
        <p className="mt-7 max-w-3xl text-base leading-8">{t.aboutText}</p>
        <section className="mt-16">
          <h2 className="display text-4xl">{t.gallery}</h2>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {t.stockNote}
          </p>
          <div className="mt-8">
            <Gallery photos={gallery} locale={locale} />
          </div>
        </section>
        <section className="mt-16">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="display text-4xl">{t.reviews}</h2>
            <Link href="#leave-review" className="btn-outline-gold">
              {d.experience.reviewWrite}
            </Link>
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {d.experience.reviewLanguage}
          </p>
          {reviews.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {reviews.map((review) => (
                <blockquote className="card p-6" key={review.id}>
                  <p
                    className="text-[var(--gold)]"
                    aria-label={`${review.rating}/5`}
                  >
                    {"★".repeat(review.rating)}
                  </p>
                  <p className="mt-4 text-sm leading-7">
                    {en ? review.text_en : review.text_ru}
                  </p>
                  <cite className="mt-5 block text-sm text-[var(--text-secondary)]">
                    {review.author}
                  </cite>
                </blockquote>
              ))}
            </div>
          ) : (
            <p className="card mt-8 p-8">{t.emptyReviews}</p>
          )}
        </section>
        <ReviewForm locale={locale} demo={!hasContentBackend()} />
      </div>
    </main>
  );
}
