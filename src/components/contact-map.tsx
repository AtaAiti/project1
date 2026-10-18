"use client";

import { getDictionary } from "@/lib/dictionaries";
import { useConsent } from "@/components/cookie-consent";

export function ContactMap({ locale }: { locale: string }) {
  const t = getDictionary(locale).map;
  const { choice, choose } = useConsent();
  return (
    <section className="card mt-8 overflow-hidden" aria-label={t.title}>
      <div className="p-5">
        <h2 className="display text-2xl">{t.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{t.demo}</p>
      </div>
      {choice?.externalMedia ? (
        <iframe
          title={t.title}
          src="https://www.openstreetmap.org/export/embed.html?bbox=74.55%2C42.84%2C74.65%2C42.90&layer=mapnik"
          className="h-80 w-full border-0 bg-[var(--bg-secondary)]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="grid min-h-64 place-content-center gap-5 border-y border-[var(--border)] bg-[var(--bg-secondary)] p-6 text-center">
          <p className="max-w-sm text-sm leading-6">{t.consent}</p>
          <button type="button" onClick={() => choose(true)} className="btn-gold">{t.load}</button>
        </div>
      )}
      <a href="https://www.openstreetmap.org/#map=13/42.87/74.60" target="_blank" rel="noopener noreferrer" className="block p-5 text-sm text-[var(--gold)] underline underline-offset-4">{t.open} ↗</a>
    </section>
  );
}
