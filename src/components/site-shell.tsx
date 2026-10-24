"use client";
import { trapDialogTab } from "@/lib/dialog-focus";

import Link from "@/components/feedback-link";
import Image from "next/image";
import { AgeGate } from "@/components/age-gate";
import { DocumentLanguage } from "@/components/document-language";
import { CookieBanner } from "@/components/cookie-consent";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Locale } from "@/lib/dictionaries";
import { PublicFooter } from "@/components/public-footer";
import { Breadcrumbs } from "@/components/breadcrumbs";

type Dictionary = ReturnType<typeof import("@/lib/dictionaries").getDictionary>;
const navigation = ["about", "afisha", "menu", "tables", "contacts"] as const;

export function Logo({
  locale,
  tagline,
  onClick,
}: {
  locale: Locale;
  tagline: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={`/${locale}`}
      data-brand-logo
      onClick={onClick}
      className="block shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
    >
      <Image
        src="/brand/literator-gold.png"
        alt="ЛитераторЪ"
        width={1679}
        height={937}
        sizes="144px"
        className="h-20 w-36 object-contain"
        loading="eager"
      />
      <span className="sr-only"> {tagline}</span>
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
  const router = useRouter();
  const logoTaps = useRef({ count: 0, last: 0 });
  useEffect(() => {
    const reset = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest("[data-brand-logo]")
      ) {
        logoTaps.current = { count: 0, last: 0 };
      }
    };
    document.addEventListener("pointerdown", reset);
    return () => document.removeEventListener("pointerdown", reset);
  }, []);
  function handleLogoClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    setMenuOpen(false);
    const now = event.timeStamp;
    const count =
      now - logoTaps.current.last <= 1200 ? logoTaps.current.count + 1 : 1;
    logoTaps.current = { count, last: now };
    if (count === 7) {
      event.preventDefault();
      logoTaps.current = { count: 0, last: 0 };
      setMenuOpen(false);
      router.push("/admin/login");
    }
  }
  const activeSection = pathname.split("/")[2] || "";
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const other = locale === "ru" ? "en" : "ru";
  const languagePath = pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${other}`);
  const t = dictionary.publicUi;
  const bookingPath = `/booking?locale=${locale}`;
  useEffect(() => {
    const node = menu.current;
    if (!menuOpen) {
      node?.close();
      return;
    }
    node?.showModal();
    node?.querySelector<HTMLAnchorElement>("a")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resize = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", resize);
    return () => {
      node?.close();
      document.body.style.overflow = previous;
      desktop.removeEventListener("change", resize);
    };
  }, [menuOpen]);
  const links = navigation.map((key) => [key, dictionary.nav[key]] as const);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <DocumentLanguage locale={locale} />
      <a
        data-skip-content
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-[var(--gold)] focus:px-5 focus:py-3 focus:text-[var(--bg-primary)]"
      >
        {t.skipToContent}
      </a>
      <header className="sticky top-0 z-30 flex min-h-24 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-primary)]/95 px-6 py-2 backdrop-blur md:px-12">
        <Logo
          locale={locale}
          tagline={dictionary.tagline}
          onClick={handleLogoClick}
        />
        <nav
          className="hidden items-center gap-5 lg:flex"
          aria-label={t.navigation}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={`/${locale}/${href}`}
              aria-current={activeSection === href ? "page" : undefined}
              className={`px-1 py-3 text-sm ${activeSection === href ? "nav-current" : "hover:text-[var(--gold)]"}`}
            >
              {label}
            </Link>
          ))}
          <Link
            href={languagePath}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-xs font-bold text-[var(--gold)]"
          >
            {other.toUpperCase()}
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
      <Breadcrumbs locale={locale} />
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      <PublicFooter locale={locale} />
      <CookieBanner locale={locale} />
      <dialog
        onKeyDown={trapDialogTab}
        ref={menu}
        id="visitor-menu"
        aria-label={t.navigation}
        onCancel={() => setMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMenuOpen(false);
        }}
        className={`fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col justify-between overflow-y-auto border-0 bg-[var(--bg-primary)] px-6 py-7 text-[var(--text-primary)] ${menuOpen ? "flex" : "hidden"}`}
      >
        <div>
          <div className="flex items-center justify-between">
            <Logo
              locale={locale}
              tagline={dictionary.tagline}
              onClick={handleLogoClick}
            />
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
                aria-current={activeSection === href ? "page" : undefined}
                className={`block border-b border-[var(--border)] py-4 font-serif text-2xl ${activeSection === href ? "nav-current" : ""}`}
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
          </nav>
        </div>
        <Link
          href={bookingPath}
          onClick={() => setMenuOpen(false)}
          className="btn-gold mt-8 text-center"
        >
          {t.reserve}
        </Link>
      </dialog>
      <AgeGate locale={locale} />
    </div>
  );
}
