"use client";
import { useState } from "react";
import { isBookingErrorKey, type BookingErrorKey } from "@/lib/booking-errors";
import { validateBookingInput } from "@/lib/booking-validation";
import { getDictionary, type Locale } from "@/lib/dictionaries";

export function BookingForm({ locale }: { locale: string }) {
  const resolvedLocale: Locale = locale === "en" ? "en" : "ru";
  const dictionary = getDictionary(resolvedLocale);
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
      setSent(true);
    } catch {
      setErrorKey("error.generic");
    } finally {
      setLoading(false);
    }
  }

  if (sent) return <div className="card p-8"><p className="section-label">Telegram</p><h2 className="display mt-4 text-3xl">{resolvedLocale === "ru" ? "Заявка отправлена" : "Request sent"}</h2></div>;

  return <form noValidate onSubmit={submit} className="card grid gap-4 p-6"><input required name="name" placeholder="Имя / Name" className="input-field"/><input required name="phone" type="tel" placeholder="Телефон / Phone" className="input-field"/><div className="grid gap-4 sm:grid-cols-2"><input required name="date" type="date" className="input-field"/><input required name="time" type="time" className="input-field"/></div><input required name="guests" type="number" min="1" max="20" placeholder="Гостей / Guests" className="input-field"/><textarea name="comment" rows={3} placeholder="Комментарий / Comment" className="input-field resize-none"/>{errorKey && <p className="text-sm text-[var(--error)]">{dictionary.errors[errorKey]}</p>}<button disabled={loading} className="btn-gold">{loading ? (resolvedLocale === "ru" ? "ОТПРАВЛЯЕМ..." : "SENDING...") : (resolvedLocale === "ru" ? "ОТПРАВИТЬ ЗАЯВКУ" : "SEND REQUEST")}</button></form>;
}
