"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/dictionaries";

type Dictionary = ReturnType<typeof import("@/lib/dictionaries").getDictionary>;
const navigation = ["about", "afisha", "menu", "contacts"] as const;

export function Logo({ locale, tagline }: { locale: Locale; tagline: string }) {
  return <Link href={`/${locale}`} className="display text-xl font-bold tracking-wide">ЛИТЕРАТОРЪ<span className="sr-only"> {tagline}</span></Link>;
}

export function SiteShell({ locale, dictionary, children }: { locale: Locale; dictionary: Dictionary; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const other = locale === "ru" ? "en" : "ru";
  const languagePath = pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${other}`);
  useEffect(() => { const frame = requestAnimationFrame(() => setGateOpen(localStorage.getItem("age-confirmed") !== "true")); return () => cancelAnimationFrame(frame); }, []);
  useEffect(() => { document.body.style.overflow = menuOpen || gateOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [menuOpen, gateOpen]);
  const links = navigation.map((key) => [key, dictionary.nav[key]] as const);
  const confirmAge = () => { localStorage.setItem("age-confirmed", "true"); setGateOpen(false); };
  return <div className="min-h-screen bg-[var(--bg-primary)]"><header className="relative z-30 flex h-20 items-center justify-between border-b border-[var(--border)] bg-neutral-950/95 px-6 md:px-20"><Logo locale={locale} tagline={dictionary.tagline}/><nav className="hidden items-center gap-8 md:flex">{links.map(([href, label]) => <Link key={href} href={`/${locale}/${href}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{label}</Link>)}<Link href={languagePath} className="text-xs font-bold text-[var(--gold)]">{other.toUpperCase()}</Link><Link href="/booking" className="grid h-9 w-9 place-items-center border border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold)]" aria-label="Забронировать">⌑</Link></nav><button onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center border border-[var(--gold)] text-[var(--gold)] md:hidden" aria-label="Открыть меню">☰</button></header>{children}<div className={`fixed inset-0 z-40 flex flex-col justify-between bg-zinc-950 px-6 py-7 transition-transform md:hidden ${menuOpen ? "translate-x-0" : "translate-x-full"}`}><div><div className="flex items-center justify-between"><Logo locale={locale} tagline={dictionary.tagline}/><button onClick={() => setMenuOpen(false)} className="h-10 w-10 border border-[var(--gold)] text-xl text-[var(--gold)]" aria-label="Закрыть меню">×</button></div><nav className="mt-14">{[["", dictionary.nav.home], ...links].map(([href, label], index) => <Link key={href} href={`/${locale}/${href}`} onClick={() => setMenuOpen(false)} className={`flex justify-between border-b border-[var(--border)] py-4 font-serif text-2xl ${index === 0 ? "text-[var(--gold)]" : "text-[var(--text-primary)]"}`}><span>{label}</span><small className="font-sans text-[10px] text-[var(--text-muted)]">{String(index + 1).padStart(2, "0")}</small></Link>)}</nav></div><Link href="/booking" onClick={() => setMenuOpen(false)} className="btn-gold flex justify-center">Забронировать стол</Link></div>{gateOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"><div className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-neutral-900 px-6 pb-7 pt-10 text-center"><p className="display text-3xl font-bold">ЛИТЕРАТОРЪ</p><p className="mt-3 text-[10px] uppercase tracking-[.2em] text-[var(--gold)]">Место встречи между строк</p><div className="mx-auto mt-3 h-px w-16 bg-[var(--gold)]"/><h2 className="display mt-7 text-2xl">Вам уже исполнилось 18 лет?</h2><p className="mt-2 font-serif text-[var(--gold)]">Are you 18 or older?</p><p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">Сайт содержит информацию о барной карте. Подтвердите совершеннолетие, чтобы продолжить.</p><div className="mt-7 grid gap-3"><button onClick={confirmAge} className="btn-gold">Да / Yes, I am 18+</button><button onClick={() => { window.location.href = "https://www.google.com"; }} className="btn-outline-gold">Нет / No, under 18</button></div></div></div>}</div>;
}
