import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Пока основной домен не задан, индексация запрещена.
  if (!getSiteUrl()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml") ?? undefined,
    host: getSiteUrl() ?? undefined,
  };
}
