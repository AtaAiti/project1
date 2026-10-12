"use client";

import { useId, useState } from "react";
import { isBookingErrorKey, type BookingErrorKey } from "@/lib/booking-errors";
import { validateBookingInput } from "@/lib/booking-validation";
import { getDictionary } from "@/lib/dictionaries";

export function BookingForm({ locale, onSuccess, expanded = false }: { locale: string; onSuccess?: () => void; expanded?: boolean }) {
  const dictionary = getDictionary(locale);
  const t = dictionary.booking;
  const id = useId();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<BookingErrorKey | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const validation = validateBookingInput(payload);
    if (validation.errorKey) { setErrorKey(validation.errorKey); return; }
    setLoading(true);
    setErrorKey(null);
    try {
      const response = await fetch("/api/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validation.data) });
      const result: { errorKey?: unknown } = await response.json();
      if (!response.ok) { setErrorKey(isBookingErrorKey(result.errorKey) ? result.errorKey : "error.generic"); return; }
      if (onSuccess) onSuccess();
      else setSent(true);
    } catch { setErrorKey("error.generic"); }
    finally { setLoading(false); }
  }

  if (sent) return <div role="status" className="card p-8"><h2 className="display text-3xl">{t.successTitle}</h2><p className="mt-4">{t.successText}</p></div>;

  const labelClass = "text-sm text-[var(--text-primary)]";
  const wide = expanded ? "md:col-span-2" : "";
  return <form noValidate onSubmit={submit} aria-describedby={errorKey ? id + "-error" : undefined} className={`card relative grid gap-5 p-6 ${expanded ? "md:grid-cols-2 md:p-10" : ""}`}>
    <label className={labelClass} htmlFor={id + "-name"}>{t.name}<input id={id + "-name"} name="name" autoComplete="name" maxLength={200} required className="input-field mt-2" placeholder={t.namePlaceholder} /></label>
    <label className={labelClass} htmlFor={id + "-phone"}>{t.phone}<input id={id + "-phone"} name="phone" autoComplete="tel" inputMode="tel" required type="tel" className="input-field mt-2" placeholder={t.phonePlaceholder} /></label>
    <label className={labelClass} htmlFor={id + "-date"}>{t.date}<input id={id + "-date"} name="date" required type="date" className="input-field mt-2" /></label>
    <label className={labelClass} htmlFor={id + "-time"}>{t.time}<input id={id + "-time"} name="time" required type="time" defaultValue="19:30" className="input-field mt-2" /></label>
    <label className={labelClass + " " + wide} htmlFor={id + "-guests"}>{t.guests}<input id={id + "-guests"} name="guests" required type="number" min="1" max="20" className="input-field mt-2" placeholder={t.guestsPlaceholder} /></label>
    <label className={labelClass + " " + wide} htmlFor={id + "-comment"}>{t.comment}<textarea id={id + "-comment"} name="comment" rows={3} maxLength={5000} className="input-field mt-2 resize-none" placeholder={t.commentPlaceholder} /></label>
    <div aria-hidden="true" className="absolute -left-[10000px]"><label htmlFor={id + "-website"}>{t.honeypot}</label><input id={id + "-website"} name="website" tabIndex={-1} autoComplete="off" /></div>
    {errorKey && <p id={id + "-error"} role="alert" className={"text-sm text-[var(--text-primary)] " + wide}>{dictionary.errors[errorKey]}</p>}
    <button disabled={loading} className={"btn-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] " + wide}>{loading ? t.sending : t.submit}</button>
  </form>;
}
