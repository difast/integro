import type { MetadataRoute } from "next";
import { services } from "@/config/services";
import { getMetadataBase } from "@/lib/site";

const staticRoutes: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/uslugi", priority: 0.9 },
  { path: "/o-kompanii", priority: 0.7 },
  { path: "/poryadok-raboty", priority: 0.8 },
  { path: "/kontakty", priority: 0.8 },
  { path: "/politika-konfidencialnosti", priority: 0.2 },
  { path: "/soglasie-na-obrabotku", priority: 0.2 },
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
