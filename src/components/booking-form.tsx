"use client";

import { useId, useRef, useState } from "react";
import { isBookingErrorKey, type BookingErrorKey } from "@/lib/booking-errors";
import { validateBookingInput, type BookingPayload } from "@/lib/booking-validation";
import { VisitPicker } from "@/components/visit-picker";
import { useTableAvailability } from "@/components/use-table-availability";
import { getDictionary } from "@/lib/dictionaries";
import Link from "@/components/feedback-link";
import { useBookingDraft, type BookingDraft } from "@/components/booking-draft";
import { findVenueTable } from "@/lib/venue-tables";

export function BookingForm({ locale, onSuccess, expanded = false, tableId }: {
  locale: string;
  onSuccess?: (payload: BookingPayload) => void;
  expanded?: boolean;
  tableId?: string;
}) {
  const dictionary = getDictionary(locale);
  const t = dictionary.booking;
  const table = findVenueTable(tableId);
  const { draft, updateDraft, clearDraft, selectTable } = useBookingDraft();
  const id = useId();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const availability = useTableAvailability(draft.date, draft.time, draft.guests);
  const [errorKey, setErrorKey] = useState<BookingErrorKey | null>(null);
  const inFlight = useRef(false);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  function reportError(key: BookingErrorKey) {
    setErrorKey(key);
    requestAnimationFrame(() => errorMessage.current?.focus());
  }
  function change(field: keyof BookingDraft, value: string) {
    updateDraft({ [field]: value });
    setErrorKey(null);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const validation = validateBookingInput(Object.fromEntries(new FormData(event.currentTarget).entries()));
    if (validation.errorKey) { reportError(validation.errorKey); return; }
    if (table && availability.status === "ready" && !availability.available.includes(table.id)) { reportError("validation.tableUnavailable"); return; }
    inFlight.current = true;
    setLoading(true);
    setErrorKey(null);
    try {
      const response = await fetch("/api/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validation.data) });
      const result: { errorKey?: unknown } = await response.json();
      if (!response.ok) { if (response.status === 409) availability.retry(); reportError(isBookingErrorKey(result.errorKey) ? result.errorKey : "error.generic"); return; }
      clearDraft();
      if (onSuccess) onSuccess(validation.data);
      else setSent(true);
    } catch { reportError("error.generic"); }
    finally { inFlight.current = false; setLoading(false); }
  }

  if (sent) return <div role="status" className="card p-8"><h2 className="display text-3xl">{t.successTitle}</h2><p className="mt-4">{t.successText}</p></div>;
  const labelClass = "text-sm text-[var(--text-primary)]";
  const wide = expanded ? "md:col-span-2" : "";
  const tooManyGuests = table && Number(draft.guests) > table.seats;
  return (
    <form noValidate onSubmit={submit} aria-busy={loading} aria-describedby={errorKey ? id + "-error" : undefined} className={`card relative grid gap-5 p-6 ${expanded ? "md:grid-cols-2 md:p-10" : ""}`}>
      {table && <div className={"rounded-lg border border-[var(--gold-border)] bg-[var(--bg-secondary)] p-4 " + wide}>
        <input type="hidden" name="table_id" value={table.id} />
        <p className="font-bold text-[var(--gold)]">{dictionary.tables.selected}: {table.id} · {dictionary.tables.seats}: {table.seats}</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{dictionary.tables.confirmation}</p>
        <div className="mt-2 flex flex-wrap gap-x-5">
          <Link href={`/${locale}/tables?table=${table.id}`} aria-disabled={loading} onClick={(event) => { if (inFlight.current) event.preventDefault(); }} className="inline-block py-2 text-sm underline underline-offset-4">{dictionary.tables.change}</Link>
          <Link href={`/booking?locale=${locale}`} aria-disabled={loading} onClick={(event) => { if (inFlight.current) event.preventDefault(); else selectTable(""); }} className="inline-block py-2 text-sm underline underline-offset-4">{dictionary.tables.remove}</Link>
        </div>
      </div>}
      {!table && <Link href={`/${locale}/tables`} className={"py-2 text-sm text-[var(--gold)] underline underline-offset-4 " + wide}>{dictionary.tables.chooseTable}</Link>}
      <label className={labelClass} htmlFor={id + "-name"}>{t.name}<input disabled={loading} id={id + "-name"} name="name" value={draft.name} onChange={(e) => change("name", e.target.value)} autoComplete="name" maxLength={200} required className="input-field mt-2" placeholder={t.namePlaceholder} /></label>
      <label className={labelClass} htmlFor={id + "-phone"}>{t.phone}<input disabled={loading} id={id + "-phone"} name="phone" value={draft.phone} onChange={(e) => change("phone", e.target.value)} autoComplete="tel" inputMode="tel" required type="tel" className="input-field mt-2" placeholder={t.phonePlaceholder} /></label>
      <div className={wide}><VisitPicker locale={locale} date={draft.date} time={draft.time} guests={draft.guests} onChange={(patch) => { updateDraft(patch); setErrorKey(null); }} disabled={loading} maxGuests={table?.seats ?? 20} /></div>
      {tooManyGuests && <p role="alert" className={wide + " text-sm text-[var(--error)]"}>{dictionary.errors["validation.tableCapacity"]}</p>}
      {table && <div role="status" className={wide + " text-sm text-[var(--text-secondary)]"}>
        {availability.status === "loading" ? dictionary.visit.checking : availability.status === "error" ? dictionary.visit.unavailable : availability.status === "ready" ? availability.available.includes(table.id) ? dictionary.visit.available : dictionary.errors["validation.tableUnavailable"] : availability.status === "demo" ? dictionary.visit.demo : dictionary.visit.chooseTime}
        {availability.status === "error" && <button type="button" onClick={availability.retry} className="visit-chip ml-3">{dictionary.visit.retry}</button>}
      </div>}
      <label className={labelClass + " " + wide} htmlFor={id + "-comment"}>{t.comment}<textarea disabled={loading} id={id + "-comment"} name="comment" value={draft.comment} onChange={(e) => change("comment", e.target.value)} rows={3} maxLength={5000} className="input-field mt-2 resize-none" placeholder={t.commentPlaceholder} /></label>
      <div aria-hidden="true" className="absolute -left-[10000px]"><label htmlFor={id + "-website"}>{t.honeypot}</label><input id={id + "-website"} name="website" tabIndex={-1} autoComplete="off" /></div>
      {errorKey && <p ref={errorMessage} tabIndex={-1} id={id + "-error"} role="alert" className={"text-sm text-[var(--text-primary)] " + wide}>{dictionary.errors[errorKey]}</p>}
      <button type="submit" disabled={loading} className={"btn-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] " + wide}>{loading ? t.sending : t.submit}</button>
    </form>
  );
}
