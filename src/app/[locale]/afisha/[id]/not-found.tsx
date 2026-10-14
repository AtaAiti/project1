import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
export default function NotFound() {
  return (
    <main className="p-12">
      {(["ru", "en"] as const).map((locale) => {
        const t = getDictionary(locale).rsvp;
        return (
          <section key={locale} lang={locale} className="mb-8">
            <h1 className="display text-3xl">{t.notFound}</h1>
            <Link
              href={`/${locale}/afisha`}
              className="mt-4 inline-block text-[var(--gold)]"
            >
              {t.back}
            </Link>
          </section>
        );
      })}
    </main>
  );
}
