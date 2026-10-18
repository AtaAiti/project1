"use client";

import { useState } from "react";
import Link from "@/components/feedback-link";
import { getDictionary } from "@/lib/dictionaries";
import { VENUE_TABLES, findVenueTable } from "@/lib/venue-tables";

export function TablePicker({ locale }: { locale: string }) {
  const t = getDictionary(locale).tables;
  const [selected, setSelected] = useState("");
  const table = findVenueTable(selected);
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="card p-3 sm:p-6">
        <div role="group" aria-label={t.plan} className="relative h-[450px] rounded-lg border-2 border-[var(--gold-border)] bg-[var(--bg-secondary)] sm:h-[500px]">
          <span className="absolute inset-x-8 top-4 border-t-4 border-[var(--gold-border)] pt-2 text-center text-xs text-[var(--text-secondary)]">{t.windows}</span>
          <span className="absolute left-1 top-[41%] text-xs text-[var(--text-secondary)] [writing-mode:vertical-rl]">{t.library}</span>
          <span className="absolute left-1/2 top-[48%] -translate-x-1/2 text-xs text-[var(--text-secondary)]" aria-hidden="true">{t.aisle}</span>
          {VENUE_TABLES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === selected}
              aria-label={`${t.table} ${item.id}, ${t.seats}: ${item.seats}, ${t.zones[item.zone]}`}
              onClick={() => setSelected(item.id)}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-2 py-3 text-center shadow-[0_5px_0_var(--border)] ${item.id === selected ? "border-[var(--gold)] bg-[var(--gold)] text-[#210c14]" : "border-[var(--gold-border)] bg-[var(--bg-card)] hover:border-[var(--gold)]"} w-[68px] sm:w-24`}
            >
              <span className="block font-bold">{item.id}</span>
              <span className="mt-1 block text-xs">{t.guestsShort}: {item.seats}</span>
            </button>
          ))}
          <span className="absolute bottom-4 left-5 text-xs text-[var(--text-secondary)]">↑ {t.entrance}</span>
          <span className="absolute bottom-4 right-5 rounded border border-[var(--gold-border)] px-8 py-3 text-xs text-[var(--gold)]">{t.bar}</span>
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">{t.demo}</p>
      </div>
      <section className="card self-start p-6 lg:sticky lg:top-28">
        <p className="section-label">{t.selection}</p>
        <div aria-live="polite">
          <h2 className="display mt-4 text-3xl">{table ? `${t.table} ${table.id}` : t.choose}</h2>
          {table && <p className="mt-4">{t.seats}: {table.seats} · {t.zones[table.zone]}</p>}
        </div>
        <p className="mt-5 text-sm leading-6 text-[var(--text-secondary)]">{t.confirmation}</p>
        {table ? (
          <Link href={`/booking?locale=${locale}&table=${table.id}`} className="btn-gold mt-6 block text-center">{t.continue}</Link>
        ) : <p className="mt-6 rounded border border-[var(--border)] p-4 text-sm">{t.hint}</p>}
        <Link href={`/booking?locale=${locale}`} className="mt-5 block py-2 text-sm text-[var(--gold)] underline underline-offset-4">{t.anyTable}</Link>
      </section>
    </div>
  );
}
