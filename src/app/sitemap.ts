import type { MetadataRoute } from "next";
import { legalDocumentList, legalIndexPath } from "@/config/legal";
import { services } from "@/config/services";
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
  ];
  return routes.map((route) => ({
    url: `${base}${route.path === "/" ? "" : route.path}`,
    changeFrequency: "monthly",
    priority: route.priority,
  }));
}
