"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookingForm } from "@/components/booking-form";
import { getDictionary, type Locale } from "@/lib/dictionaries";

export function BookingClient({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const t = getDictionary(locale).booking;
  if (sent) return <main className="grid min-h-screen place-items-center px-6"><section role="status" className="card w-full max-w-2xl p-8 text-center md:p-12"><p className="mb-5 text-4xl" aria-hidden="true">✓</p><h1 className="display text-4xl">{t.successTitle}</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6">{t.successText}</p><Link href={`/${locale}`} className="btn-outline-gold mt-8 inline-block">{t.home}</Link></section></main>;
  return <main className="min-h-screen px-6 py-16 md:px-16 md:py-24"><div className="mx-auto max-w-4xl"><button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push(`/${locale}`)} className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] text-[var(--text-primary)] focus-visible:outline-2">← {t.back}</button><p className="section-label">{t.eyebrow}</p><h1 className="display mt-5 text-5xl md:text-7xl">{t.title}</h1><p className="mt-5 max-w-lg text-sm leading-6">{t.intro}</p><div className="mt-10"><BookingForm locale={locale} expanded onSuccess={() => setSent(true)} /></div></div></main>;
}
