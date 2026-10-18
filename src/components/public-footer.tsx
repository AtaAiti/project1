import { CookieSettings } from "@/components/cookie-consent";
import Link from "@/components/feedback-link";
import { getDictionary } from "@/lib/dictionaries";

export function PublicFooter({ locale }: { locale: string }) {
  const t = getDictionary(locale);
  return (
    <footer className="grid gap-8 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-12 md:grid-cols-3 md:px-16">
      <div>
        <p className="display text-3xl">{t.publicUi.brand}</p>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{t.tagline}</p>
        <p className="mt-4 text-sm">{t.publicUi.footerText}</p>
      </div>
      <nav
        aria-label={t.publicUi.navigation}
        className="grid content-start gap-3 text-sm"
      >
        {(["about", "menu", "afisha", "tables", "contacts"] as const).map((key) => (
          <Link href={`/${locale}/${key}`} key={key}>
            {t.nav[key]}
          </Link>
        ))}
        <CookieSettings locale={locale} />
      </nav>
      <div className="space-y-3 text-sm">
        <p>{t.publicUi.address}</p>
        <p className="text-[var(--text-secondary)]">{t.publicUi.addressNote}</p>
        <p>{t.publicUi.hours}</p>
        <a className="block" href="tel:+996779118824">
          {t.publicUi.phone}
        </a>
        <a
          className="block text-[var(--gold)]"
          href="https://wa.me/996779118824"
        >
          {t.publicUi.whatsapp}
        </a>
        <p className="pt-3 text-xs text-[var(--text-secondary)]">
          {t.publicUi.stockCredit}
        </p>
      </div>
    </footer>
  );
}
