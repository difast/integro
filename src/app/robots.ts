import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Пока основной домен не задан, индексация запрещена.
  if (!getSiteUrl()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    // Закрытая панель и служебные API не индексируются (у них и так noindex); ИИ-поиск и обычные поисковики — по одним правилам.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: absoluteUrl("/sitemap.xml") ?? undefined,
    host: getSiteUrl() ?? undefined,
  };
}
