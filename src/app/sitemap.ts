import type { MetadataRoute } from "next";
import { legalDocumentList, legalIndexPath } from "@/config/legal";
import { services } from "@/config/services";
import { getArticles } from "@/lib/articles";
import { getMetadataBase } from "@/lib/site";

const staticRoutes: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/uslugi", priority: 0.9 },
  { path: "/o-kompanii", priority: 0.7 },
  { path: "/poryadok-raboty", priority: 0.8 },
  { path: "/kontakty", priority: 0.8 },
  { path: legalIndexPath, priority: 0.3 },
  ...legalDocumentList.map((doc) => ({ path: doc.href, priority: 0.3 })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getMetadataBase().origin;
  const routes = [
    ...staticRoutes,
    ...services.map((service) => ({ path: `/uslugi/${service.slug}`, priority: 0.9 })),
    { path: "/stati", priority: 0.7 },
  ];
  const pages: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${base}${route.path === "/" ? "" : route.path}`,
    changeFrequency: "monthly",
    priority: route.priority,
  }));
  // Опубликованные статьи (черновики в production исключаются в getArticles).
  const articles: MetadataRoute.Sitemap = getArticles()
    .filter((a) => !a.draft)
    .map((a) => ({
      url: `${base}/stati/${a.slug}`,
      lastModified: a.updated ?? a.published,
      changeFrequency: "yearly",
      priority: 0.6,
    }));
  return [...pages, ...articles];
}
