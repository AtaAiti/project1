import { afterEach, expect, it, vi } from "vitest";
import {
  localizedMetadata,
  publicPages,
  pagePath,
  routeLocale,
  siteOrigin,
} from "@/lib/site-seo";
import { getDictionary } from "@/lib/dictionaries";
import robots from "@/app/robots";
afterEach(() => vi.unstubAllEnvs());
it("selects the document language only from the route and booking locale", () => {
  expect(routeLocale("/en/menu")).toBe("en");
  expect(routeLocale("/enough")).toBe("ru");
  expect(routeLocale("/booking", "en")).toBe("en");
  expect(routeLocale("/admin/login", "en")).toBe("ru");
  expect(routeLocale("/ru", "en")).toBe("ru");
});
it("uses the production origin and never a preview/request host for canonical URLs", () => {
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "literator-xi.vercel.app");
  vi.stubEnv("VERCEL_URL", "untrusted-preview.vercel.app");
  expect(siteOrigin()).toBe("https://literator-xi.vercel.app");
});
it("provides unique translated metadata and reciprocal language alternates on every page", () => {
  const titles = new Set();
  for (const locale of ["ru", "en"] as const)
    for (const page of [...publicPages, "booking", "styleguide"] as const) {
      const m = localizedMetadata(locale, page);
      expect(m.title).toBe(getDictionary(locale).seo[page].title);
      expect(m.description?.length).toBeGreaterThan(25);
      expect(m.openGraph).toMatchObject({
        url: siteOrigin() + pagePath(locale, page),
        locale: locale === "ru" ? "ru_RU" : "en_GB",
      });
      expect(m.twitter).toMatchObject({ card: "summary_large_image" });
      expect(m.alternates?.languages).toEqual({
        ru: siteOrigin() + pagePath("ru", page),
        en: siteOrigin() + pagePath("en", page),
        "x-default": siteOrigin() + pagePath("ru", page),
      });
      titles.add(m.title);
    }
  expect(titles.size).toBe(16);
});
it("keeps table preferences and personal data out of booking canonicals", () => {
  expect(localizedMetadata("en", "booking").alternates?.canonical).toBe(
    siteOrigin() + "/booking?locale=en",
  );
});
it("localizes event metadata and points at the same event in each language", () => {
  const m = localizedMetadata("en", "afisha", {
    title: "Reading evening",
    description: "  Public\n event description ",
    path: (l) => `/${l}/afisha/123`,
    image: "/event.jpg",
  });
  expect(m.title).toBe("Reading evening | Literator");
  expect(m.description).toBe("Public event description");
  expect(m.alternates?.languages?.ru).toBe(siteOrigin() + "/ru/afisha/123");
});
it("excludes administration, APIs and styleguides from indexing", () => {
  expect(robots()).toMatchObject({
    sitemap: siteOrigin() + "/sitemap.xml",
    rules: {
      disallow: ["/admin", "/api/", "/ru/styleguide", "/en/styleguide"],
    },
  });
  expect(localizedMetadata("en", "styleguide").robots).toEqual({
    index: false,
    follow: false,
  });
});
