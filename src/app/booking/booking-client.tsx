"use client";

import { DocumentLanguage } from "@/components/document-language";
import Link from "@/components/feedback-link";
import { useState } from "react";
import { CookieBanner, CookieSettings } from "@/components/cookie-consent";
import { BookingForm } from "@/components/booking-form";
import { getDictionary, type Locale } from "@/lib/dictionaries";
import type { BookingPayload } from "@/lib/booking-validation";

export function BookingClient({
  locale,
  tableId,
  invalidTable = false,
}: {
  locale: Locale;
  tableId?: string;
  invalidTable?: boolean;
}) {
  const [sent, setSent] = useState<BookingPayload | null>(null);
  const d = getDictionary(locale);
  const t = d.booking;
  if (sent)
    return (
      <>
        <DocumentLanguage locale={locale} />
        <CookieBanner locale={locale} />
        <main
          lang={locale}
          className="grid min-h-screen place-items-center px-6"
        >
          <section
            role="status"
            className="card w-full max-w-2xl p-8 text-center md:p-12"
          >
            <p className="mb-5 text-4xl" aria-hidden="true">
              ✓
            </p>
            <h1 className="display text-4xl">{t.successTitle}</h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6">
              {t.successText}
            </p>
            <p className="mt-5 text-sm">
              {sent.date} · {sent.time} · {t.guests}: {sent.guests}
              {sent.table_id && (
                <>
                  {" "}
                  · {d.tables.table} {sent.table_id}
                </>
              )}
            </p>
            <Link
              href={`/${locale}`}
              className="btn-outline-gold mt-8 inline-block"
            >
              {t.home}
            </Link>
          </section>
        </main>
      </>
    );
  const back = tableId
    ? `/${locale}/tables?table=${tableId}`
    : invalidTable
      ? `/${locale}/tables`
      : `/${locale}`;
  return (
    <>
      <DocumentLanguage locale={locale} />
      <CookieBanner locale={locale} />
      <main lang={locale} className="min-h-screen px-6 py-16 md:px-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <Link
            href={back}
            className="mb-10 inline-flex items-center gap-2 py-2 text-xs uppercase tracking-[.18em] text-[var(--text-primary)] focus-visible:outline-2"
          >
            ← {t.back}
          </Link>
          <p className="section-label">{t.eyebrow}</p>
          <h1 className="display mt-5 text-5xl md:text-7xl">{t.title}</h1>
          <p className="mt-5 max-w-lg text-sm leading-6">{t.intro}</p>
          {invalidTable ? (
            <section className="card mt-6 p-6">
              <p role="alert">{d.tables.invalid}</p>
              <div className="mt-5 flex flex-wrap gap-4">
                <Link href={`/${locale}/tables`} className="btn-gold">
                  {d.tables.change}
                </Link>
                <Link
                  href={`/booking?locale=${locale}`}
                  className="btn-outline-gold"
                >
                  {d.tables.anyTable}
                </Link>
              </div>
            </section>
          ) : (
            <div className="mt-10">
              <BookingForm
                key={tableId || "any"}
                locale={locale}
                tableId={tableId}
                expanded
                onSuccess={setSent}
              />
            </div>
          )}
          <div className="mt-6">
            <CookieSettings locale={locale} />
          </div>
        </div>
      </main>
    </>
  );
}
