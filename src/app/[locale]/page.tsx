import Link from "@/components/feedback-link";
import { MenuDetails } from "@/components/menu-details";
import { EventBadges } from "@/components/event-badges";
import { getDictionary } from "@/lib/dictionaries";
import {
  getMenu,
  getEvents,
  getGallery,
  menuImage,
  sortUpcoming,
  hasContentBackend,
} from "@/lib/content";
import { isDemoRecord, stockImage } from "@/lib/demo-content";
import { ContentImage } from "@/components/content-image";
import { DemoNotice } from "@/components/demo-notice";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const d = getDictionary(locale);
  const t = d.publicUi;
  const en = locale === "en";
  const [menu, events, gallery] = await Promise.all([
    getMenu(),
    getEvents(),
    getGallery(),
  ]);
  const upcoming = sortUpcoming(events).slice(0, 3);
  const featured = [...menu]
    .sort((a, b) => Number(b.is_hit) - Number(a.is_hit))
    .slice(0, 4);
  const hero = gallery[0]?.image_url || stockImage("library");
  const concept = gallery[1]?.image_url || stockImage("lounge");
  const demo =
    !hasContentBackend() ||
    [...menu, ...events].some((row) => isDemoRecord(row.id));
  const booking = `/booking?locale=${locale}`;
  return (
    <main>
      {demo && <DemoNotice locale={locale} />}
      <section className="relative isolate flex min-h-[620px] items-center justify-center px-6 py-24 text-center md:min-h-[720px]">
        <ContentImage src={hero} alt="" sizes="100vw" preload />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 max-w-3xl">
          <p className="section-label">{d.hero.eyebrow}</p>
          <h1 className="display mt-6 text-6xl md:text-8xl">{t.brand}</h1>
          <p className="display mt-5 text-2xl text-[var(--gold)]">
            {d.tagline}
          </p>
          <p className="mx-auto mt-7 max-w-xl text-base leading-7">{t.intro}</p>
          <Link href={booking} className="btn-gold mt-10 inline-block">
            {t.reserve}
          </Link>
        </div>
      </section>
      <section className="grid items-center gap-10 bg-[var(--bg-secondary)] px-6 py-20 md:grid-cols-2 md:px-16">
        <div>
          <p className="section-label">{t.concept}</p>
          <h2 className="display mt-4 text-4xl md:text-5xl">
            {t.conceptTitle}
          </h2>
          <p className="mt-6 text-base leading-8 text-[var(--text-secondary)]">
            {t.conceptText}
          </p>
          <Link
            href={`/${locale}/about`}
            className="btn-outline-gold mt-8 inline-block"
          >
            {t.discover}
          </Link>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded">
          <ContentImage
            src={concept}
            alt={t.stockNote}
            sizes="(max-width:768px) 100vw, 50vw"
          />
        </div>
      </section>
      <section className="px-6 py-20 md:px-16">
        <p className="section-label">{t.programme}</p>
        <h2 className="display mt-4 text-4xl">{t.upcoming}</h2>
        {upcoming.length ? (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {upcoming.map((event) => (
              <article key={event.id} className="card overflow-hidden">
                <div className="relative aspect-[4/3]">
                  <ContentImage
                    src={event.image_url || stockImage("library")}
                    alt={en ? event.title_en : event.title_ru}
                  />
                </div>
                <div className="p-6">
                  <p className="text-sm text-[var(--gold)]">
                    {event.date} · {event.time.slice(0, 5)} · Asia/Bishkek
                  </p>
                  <h3 className="display mt-4 text-2xl">
                    {en ? event.title_en : event.title_ru}
                  </h3>
                  <EventBadges event={event} locale={locale} />
                  <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
                    {en ? event.description_en : event.description_ru}
                  </p>
                  <Link
                    href={`/${locale}/afisha/${event.id}`}
                    className="mt-6 inline-block text-sm text-[var(--gold)]"
                  >
                    {d.rsvp.details} →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="card mt-10 p-8">{t.emptyEvents}</p>
        )}
        <Link
          href={`/${locale}/afisha`}
          className="btn-outline-gold mt-10 inline-block"
        >
          {t.allEvents}
        </Link>
      </section>
      <section className="bg-[var(--bg-secondary)] px-6 py-20 md:px-16">
        <p className="section-label">{t.menuEyebrow}</p>
        <h2 className="display mt-4 text-4xl">{t.menuTitle}</h2>
        {featured.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item) => (
              <article key={item.id} className="card overflow-hidden">
                <div className="relative aspect-[4/3]">
                  <ContentImage
                    src={menuImage(item)}
                    alt={en ? item.name_en : item.name_ru}
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                  />
                </div>
                <div className="p-5">
                  <h3 className="display text-2xl">
                    {en ? item.name_en : item.name_ru}
                  </h3>
                  <p className="mt-3 text-[var(--gold)]">
                    {item.price} {t.currency}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    {en ? item.composition_en : item.composition_ru}
                  </p>
                  <MenuDetails item={item} locale={locale} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="card mt-10 p-8">{t.emptyMenu}</p>
        )}
        <p className="mt-5 text-xs text-[var(--text-secondary)]">
          {t.stockNote}
        </p>
        <Link
          href={`/${locale}/menu`}
          className="btn-outline-gold mt-10 inline-block"
        >
          {t.allMenu}
        </Link>
      </section>
      <section className="grid gap-10 px-6 py-20 md:grid-cols-2 md:px-16">
        <div>
          <h2 className="display text-4xl">{t.contacts}</h2>
          <p className="mt-6">{t.address}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t.addressNote}
          </p>
          <p className="mt-5">{t.hours}</p>
          <a href="tel:+996779118824" className="mt-5 block">
            {t.phone}
          </a>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={booking} className="btn-gold">
              {t.reserve}
            </Link>
            <a href="https://wa.me/996779118824" className="btn-outline-gold">
              {t.whatsapp}
            </a>
          </div>
        </div>
        <div className="relative min-h-80 overflow-hidden rounded">
          <ContentImage
            src={stockImage("coffee")}
            alt={t.stockNote}
            sizes="(max-width:768px) 100vw, 50vw"
          />
        </div>
      </section>
    </main>
  );
}
