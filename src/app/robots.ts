import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/ru/styleguide", "/en/styleguide"],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
