import Link from "next/link";
import type { Locale } from "@/lib/dictionaries";
type Dictionary = ReturnType<typeof import("@/lib/dictionaries").getDictionary>;

export function Logo({ locale, tagline }: { locale: Locale; tagline: string }) {
  return <Link href={`/${locale}`} className="group inline-flex flex-col"><span className="display text-3xl tracking-[-0.04em]">Литератор<span className="text-[var(--wine-bright)]">Ъ</span></span><span className="text-[9px] uppercase tracking-[0.24em] text-[var(--muted)]">{tagline}</span></Link>;
}

export function SiteShell({ locale, dictionary, children }: { locale: Locale; dictionary: Dictionary; children: React.ReactNode }) {
  const links = [["about", dictionary.nav.about], ["menu", dictionary.nav.menu], ["afisha", dictionary.nav.afisha], ["contacts", dictionary.nav.contacts]];
  const other = locale === "ru" ? "en" : "ru";
  return <div className="min-h-screen bg-[var(--paper)]"><header className="relative z-10 flex items-center justify-between border-b border-[var(--line)] px-6 py-5 md:px-12"><Logo locale={locale} tagline={dictionary.tagline}/><nav className="hidden gap-7 text-[11px] uppercase tracking-[0.17em] text-[var(--muted)] md:flex">{links.map(([href, label]) => <Link className="transition-colors hover:text-[var(--ink)]" key={href} href={`/${locale}/${href}`}>{label}</Link>)}<Link className="text-[var(--wine-bright)]" href={`/${locale}/styleguide`}>{dictionary.nav.styleguide}</Link></nav><Link href={`/${other}`} className="border border-[var(--line)] px-3 py-2 text-[10px] uppercase tracking-[0.2em] transition hover:border-[var(--wine-bright)] hover:text-[var(--wine-bright)]">{other}</Link></header>{children}</div>;
}
