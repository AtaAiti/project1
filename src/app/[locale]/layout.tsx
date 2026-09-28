import { notFound } from "next/navigation";
import { getDictionary, locales, type Locale } from "@/lib/dictionaries";
import { SiteShell } from "@/components/site-shell";

export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return <SiteShell locale={locale as Locale} dictionary={getDictionary(locale)}>{children}</SiteShell>;
}
