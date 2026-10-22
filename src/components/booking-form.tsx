"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isBookingErrorKey, type BookingErrorKey } from "@/lib/booking-errors";
import { validateBookingInput, type BookingPayload } from "@/lib/booking-validation";
import { BOOKING_OPEN_TIME, venueToday } from "@/lib/booking-time";
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
  const [minimumDate, setMinimumDate] = useState("");
  const [errorKey, setErrorKey] = useState<BookingErrorKey | null>(null);
  const inFlight = useRef(false);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMinimumDate(venueToday()));
    return () => cancelAnimationFrame(frame);
  }, []);
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
    inFlight.current = true;
    setLoading(true);
    setErrorKey(null);
    try {
      const response = await fetch("/api/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validation.data) });
      const result: { errorKey?: unknown } = await response.json();
      if (!response.ok) { reportError(isBookingErrorKey(result.errorKey) ? result.errorKey : "error.generic"); return; }
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
      <label className={labelClass} htmlFor={id + "-date"}>{t.date}<input disabled={loading} id={id + "-date"} name="date" value={draft.date} onChange={(e) => change("date", e.target.value)} min={minimumDate} required type="date" className="input-field mt-2" /></label>
      <label className={labelClass} htmlFor={id + "-time"}>{t.time}<input disabled={loading} id={id + "-time"} name="time" value={draft.time} onChange={(e) => change("time", e.target.value)} min={BOOKING_OPEN_TIME} max="21:59" required type="time" className="input-field mt-2" aria-describedby={id + "-hours"} /><span id={id + "-hours"} className="mt-2 block text-xs text-[var(--text-secondary)]">{t.hoursHint}</span></label>
      <label className={labelClass + " " + wide} htmlFor={id + "-guests"}>{t.guests}<input disabled={loading} id={id + "-guests"} name="guests" value={draft.guests} onChange={(e) => change("guests", e.target.value)} required type="number" min="1" max={table?.seats ?? 20} className="input-field mt-2" placeholder={t.guestsPlaceholder} />{tooManyGuests && <span className="mt-2 block text-sm text-[var(--error)]">{dictionary.errors["validation.tableCapacity"]}</span>}</label>
      <label className={labelClass + " " + wide} htmlFor={id + "-comment"}>{t.comment}<textarea disabled={loading} id={id + "-comment"} name="comment" value={draft.comment} onChange={(e) => change("comment", e.target.value)} rows={3} maxLength={5000} className="input-field mt-2 resize-none" placeholder={t.commentPlaceholder} /></label>
      <div aria-hidden="true" className="absolute -left-[10000px]"><label htmlFor={id + "-website"}>{t.honeypot}</label><input id={id + "-website"} name="website" tabIndex={-1} autoComplete="off" /></div>
      {errorKey && <p ref={errorMessage} tabIndex={-1} id={id + "-error"} role="alert" className={"text-sm text-[var(--text-primary)] " + wide}>{dictionary.errors[errorKey]}</p>}
      <button type="submit" disabled={loading} className={"btn-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] " + wide}>{loading ? t.sending : t.submit}</button>
    </form>
  );
}
