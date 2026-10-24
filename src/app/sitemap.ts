import type { MetadataRoute } from "next";
import { locales } from "@/lib/dictionaries";
import {
  languageAlternates,
  pagePath,
  publicPages,
  siteOrigin,
} from "@/lib/site-seo";
import { sitemapEvents } from "@/lib/sitemap-events";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [];
  for (const page of [...publicPages, "booking"] as const)
    for (const locale of locales)
      pages.push({
        url: siteOrigin() + pagePath(locale, page),
        alternates: { languages: languageAlternates((l) => pagePath(l, page)) },
      });
  for (const event of await sitemapEvents())
    for (const locale of locales)
      pages.push({
        url: `${siteOrigin()}/${locale}/afisha/${event.id}`,
        alternates: {
          languages: languageAlternates((l) => `/${l}/afisha/${event.id}`),
        },
      });
  return pages;
}
