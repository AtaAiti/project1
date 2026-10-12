"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isBookingErrorKey, type BookingErrorKey } from "@/lib/booking-errors";
import { validateBookingInput } from "@/lib/booking-validation";
import { getDictionary } from "@/lib/dictionaries";

export default function BookingPage() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [errorKey, setErrorKey] = useState<BookingErrorKey | null>(null);
  const [loading, setLoading] = useState(false);
  const dictionary = getDictionary("ru");

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

  if (sent) return <main className="grid min-h-screen place-items-center px-6"><section className="card w-full max-w-2xl p-8 text-center md:p-12"><p className="mb-5 text-4xl text-[var(--success)]">✓</p><h1 className="display text-4xl">Заявка отправлена</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[var(--text-secondary)]">Администратор получил заявку. Подтверждение придёт в Telegram в течение 15 минут.</p><Link href="/ru" className="btn-outline-gold mt-8 inline-block">На главную</Link></section></main>;

  return <main className="min-h-screen px-6 py-16 md:px-16 md:py-24"><div className="mx-auto max-w-4xl"><button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push("/ru")} className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] text-[var(--text-secondary)] transition hover:text-[var(--gold)]">← Назад</button><p className="section-label">Контакты / резерв</p><h1 className="display mt-5 text-5xl md:text-7xl">Литературный резерв</h1><p className="mt-5 max-w-lg text-sm leading-6 text-[var(--text-secondary)]">Оставьте заявку — администратор проверит стол и подтвердит бронь в Telegram в течение 15 минут.</p><form noValidate onSubmit={submit} className="card mt-10 grid gap-5 p-6 md:grid-cols-2 md:p-10"><label className="text-xs text-[var(--text-secondary)]">Имя<input name="name" required className="input-field mt-2" placeholder="Александр" /></label><label className="text-xs text-[var(--text-secondary)]">Телефон<input name="phone" required type="tel" className="input-field mt-2" placeholder="+7 999 123-45-67" /></label><label className="text-xs text-[var(--text-secondary)]">Дата<input name="date" required type="date" className="input-field mt-2" /></label><label className="text-xs text-[var(--text-secondary)]">Время<input name="time" required type="time" defaultValue="19:30" className="input-field mt-2" /></label><label className="text-xs text-[var(--text-secondary)] md:col-span-2">Количество гостей<input name="guests" required type="number" min="1" max="20" className="input-field mt-2" placeholder="2" /></label><label className="text-xs text-[var(--text-secondary)] md:col-span-2">Комментарий<textarea name="comment" rows={3} className="input-field mt-2 resize-none" placeholder="Стол у камина, если возможно..." /></label>{errorKey && <p className="text-sm text-[var(--error)] md:col-span-2">{dictionary.errors[errorKey]}</p>}<button disabled={loading} className="btn-gold py-4 md:col-span-2">{loading ? "ОТПРАВЛЯЕМ..." : "ОТПРАВИТЬ ЗАЯВКУ"}</button></form></div></main>;
}
