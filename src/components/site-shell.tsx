"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/dictionaries";
import { PublicFooter } from "@/components/public-footer";

type Dictionary = ReturnType<typeof import("@/lib/dictionaries").getDictionary>;
const navigation = ["about", "afisha", "menu", "contacts"] as const;

export function Logo({ locale, tagline }: { locale: Locale; tagline: string }) {
  return (
    <Link
      href={`/${locale}`}
      className="display text-xl font-bold tracking-wide"
    >
      ЛИТЕРАТОРЪ<span className="sr-only"> {tagline}</span>
    </Link>
  );
}

export function SiteShell({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const other = locale === "ru" ? "en" : "ru";
  const languagePath = pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${other}`);
  const t = dictionary.publicUi;
  const bookingPath = `/booking?locale=${locale}`;
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setGateOpen(localStorage.getItem("age-confirmed") !== "true"),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen || gateOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, gateOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [menuOpen]);
  const links = navigation.map((key) => [key, dictionary.nav[key]] as const);
  const confirmAge = () => {
    localStorage.setItem("age-confirmed", "true");
    setGateOpen(false);
  };
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-[var(--border)] bg-neutral-950/95 px-6 py-4 backdrop-blur md:px-12">
        <Logo locale={locale} tagline={dictionary.tagline} />
        <nav
          className="hidden items-center gap-5 lg:flex"
          aria-label={t.navigation}
        >
          {links.map(([href, label]) => (
            <Link key={href} href={`/${locale}/${href}`} className="text-sm">
              {label}
            </Link>
          ))}
          <Link
            href={languagePath}
            className="text-xs font-bold text-[var(--gold)]"
          >
            {other.toUpperCase()}
          </Link>
          <Link
            href="/admin/login"
            className="rounded border border-[var(--gold)] px-3 py-2 text-xs text-[var(--gold)]"
          >
            {t.adminLogin}
          </Link>
          <Link href={bookingPath} className="btn-gold">
            {t.reserve}
          </Link>
        </nav>
        <button
          ref={menuButton}
          onClick={() => setMenuOpen(true)}
          className="grid h-11 w-11 place-items-center border border-[var(--gold)] text-[var(--gold)] lg:hidden"
          aria-label={t.openMenu}
          aria-expanded={menuOpen}
          aria-controls="visitor-menu"
        >
          ☰
        </button>
      </header>
      {children}
      <PublicFooter locale={locale} />
      <div
        ref={menu}
        id="visitor-menu"
        inert={!menuOpen}
        className={`fixed inset-0 z-40 flex flex-col justify-between overflow-y-auto bg-zinc-950 px-6 py-7 transition-transform lg:hidden ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div>
          <div className="flex items-center justify-between">
            <Logo locale={locale} tagline={dictionary.tagline} />
            <button
              onClick={() => {
                setMenuOpen(false);
                menuButton.current?.focus();
              }}
              className="h-11 w-11 border border-[var(--gold)] text-xl text-[var(--gold)]"
              aria-label={t.closeMenu}
            >
              ×
            </button>
          </div>
          <nav className="mt-10" aria-label={t.navigation}>
            {[["", dictionary.nav.home], ...links].map(([href, label]) => (
              <Link
                key={href}
                href={`/${locale}/${href}`}
                onClick={() => setMenuOpen(false)}
                className="block border-b border-[var(--border)] py-4 font-serif text-2xl"
              >
                {label}
              </Link>
            ))}
            <Link
              href={languagePath}
              onClick={() => setMenuOpen(false)}
              className="mt-6 inline-block text-[var(--gold)]"
            >
              {other.toUpperCase()}
            </Link>
            <Link
              href="/admin/login"
              onClick={() => setMenuOpen(false)}
              className="mt-6 block text-[var(--gold)]"
            >
              {t.adminLogin}
            </Link>
          </nav>
        </div>
        <Link
          href={bookingPath}
          onClick={() => setMenuOpen(false)}
          className="btn-gold mt-8 text-center"
        >
          {t.reserve}
        </Link>
      </div>
      {gateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4">
          <div className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-neutral-900 px-6 pb-7 pt-10 text-center">
            <p className="display text-3xl font-bold">ЛИТЕРАТОРЪ</p>
            <p className="mt-3 text-[10px] uppercase tracking-[.2em] text-[var(--gold)]">
              Место встречи между строк
            </p>
            <div className="mx-auto mt-3 h-px w-16 bg-[var(--gold)]" />
            <h2 className="display mt-7 text-2xl">
              Вам уже исполнилось 18 лет?
            </h2>
            <p className="mt-2 font-serif text-[var(--gold)]">
              Are you 18 or older?
            </p>
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
              Сайт содержит информацию о барной карте. Подтвердите
              совершеннолетие, чтобы продолжить.
            </p>
            <div className="mt-7 grid gap-3">
              <button onClick={confirmAge} className="btn-gold">
                Да / Yes, I am 18+
              </button>
              <button
                onClick={() => {
                  window.location.href = "https://www.google.com";
                }}
                className="btn-outline-gold"
              >
                Нет / No, under 18
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
