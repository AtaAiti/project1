import type { Metadata } from "next";
import { getDictionary, type Locale } from "@/lib/dictionaries";
export const publicPages = [
  "home",
  "about",
  "menu",
  "afisha",
  "contacts",
  "tables",
] as const;
export type SeoPage = (typeof publicPages)[number] | "booking" | "styleguide";
export function siteOrigin() {
  const domain =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || "literator-xi.vercel.app";
  return new URL(domain.startsWith("https://") ? domain : `https://${domain}`)
    .origin;
}
export function routeLocale(
  pathname: string,
  queryLocale?: string | null,
): Locale {
  return /^\/en(?:\/|$)/.test(pathname) ||
    (pathname === "/booking" && queryLocale === "en")
    ? "en"
    : "ru";
}
export function pagePath(locale: Locale, page: SeoPage) {
  return page === "home"
    ? `/${locale}`
    : page === "booking"
      ? `/booking?locale=${locale}`
      : `/${locale}/${page}`;
}
export function languageAlternates(path: (locale: Locale) => string) {
  return {
    ru: siteOrigin() + path("ru"),
    en: siteOrigin() + path("en"),
    "x-default": siteOrigin() + path("ru"),
  };
}
export function localizedMetadata(
  locale: Locale,
  page: SeoPage,
  override?: {
    title: string;
    description: string;
    path: (locale: Locale) => string;
    image?: string;
  },
): Metadata {
  const d = getDictionary(locale),
    text = d.seo[page],
    path = override?.path ?? ((l: Locale) => pagePath(l, page));
  const title = override ? `${override.title} | ${d.seo.brand}` : text.title;
  const description = (override?.description || text.description)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const image = override?.image || "/images/stock/library.jpg",
    url = siteOrigin() + path(locale);
  return {
    metadataBase: new URL(siteOrigin()),
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: d.seo.brand,
      title,
      description,
      url,
      locale: locale === "ru" ? "ru_RU" : "en_GB",
      alternateLocale: locale === "ru" ? ["en_GB"] : ["ru_RU"],
      images: [{ url: image, alt: d.seo.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    ...(page === "styleguide"
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
