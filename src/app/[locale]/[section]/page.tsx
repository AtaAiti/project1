import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/booking-form";
import { getDictionary } from "@/lib/dictionaries";
import {
  getEvents,
  getGallery,
  getMenu,
  getReviews,
  menuImage,
  sortUpcoming,
  eventStartsAt,
  hasContentBackend,
} from "@/lib/content";
import { isDemoRecord, stockImage } from "@/lib/demo-content";
import { ContentImage } from "@/components/content-image";
import { Gallery } from "@/components/gallery";
import { DemoNotice } from "@/components/demo-notice";

const sections = ["about", "menu", "afisha", "contacts"];
export default async function SectionPage({
  params,
}: PageProps<"/[locale]/[section]">) {
  const { locale, section } = await params;
  if (!sections.includes(section)) notFound();
  const d = getDictionary(locale);
  const t = d.publicUi;
  const en = locale === "en";
  const booking = `/booking?locale=${locale}`;
  if (section === "menu") {
    const items = await getMenu();
    const categories = [...new Set(items.map((item) => item.category))];
    return (
      <main>
        {(!hasContentBackend() ||
          items.some((item) => isDemoRecord(item.id))) && (
          <DemoNotice locale={locale} />
        )}
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="section-label">{d.nav.menu}</p>
          <h1 className="display mt-5 text-5xl">{t.menuTitle}</h1>
          <p className="mt-5 text-sm text-[var(--text-secondary)]">
            {t.stockNote}
          </p>
          {!items.length && <p className="card mt-10 p-8">{t.emptyMenu}</p>}
          {categories.map((category) => (
            <section key={category} className="mt-12">
              <h2 className="display text-3xl">
                {t.categoryLabels[category as keyof typeof t.categoryLabels] ||
                  category}
              </h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <article key={item.id} className="card overflow-hidden">
                      <div className="relative aspect-[4/3]">
                        <ContentImage
                          src={menuImage(item)}
                          alt={en ? item.name_en : item.name_ru}
                        />
                      </div>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="display text-2xl">
                            {en ? item.name_en : item.name_ru}
                          </h3>
                          <span className="whitespace-nowrap text-[var(--gold)]">
                            {item.price} {t.currency}
                          </span>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
                          {en ? item.composition_en : item.composition_ru}
                        </p>
                        <div className="mt-4 flex gap-4 text-sm">
                          {item.strength && <span>{item.strength}</span>}
                          {item.is_hit && (
                            <span className="text-[var(--gold)]">{t.hit}</span>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
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
                {en ? event.title_en : event.title_ru}
              </h3>
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                {en ? event.description_en : event.description_ru}
              </p>
              {futureIds.has(event.id) && (
                <>
                  <Link
                    href={booking}
                    className="btn-outline-gold mt-6 inline-block"
                  >
                    {t.bookTable}
                  </Link>
                  <p className="mt-3 text-xs text-[var(--text-secondary)]">
                    {t.eventBookingNote}
                  </p>
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
            <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded">
              <ContentImage
                src={stockImage("lounge")}
                alt={t.stockNote}
                sizes="(max-width:1024px) 100vw, 50vw"
              />
            </div>
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
          <h2 className="display text-4xl">{t.reviews}</h2>
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
      </div>
    </main>
  );
}
