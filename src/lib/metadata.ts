import type { Metadata } from "next";
import { company } from "@/config/company";
import { getSiteUrl } from "@/lib/site";

export const ogImage = { url: "/og.png", width: 1200, height: 630, alt: company.legalName };

/**
 * Метаданные страницы: title, description, canonical и Open Graph.
 * openGraph в Next.js не сливается с родительским, поэтому общие поля задаются здесь.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const hasDomain = Boolean(getSiteUrl());
  return {
    title,
    description,
    alternates: hasDomain ? { canonical: path } : undefined,
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName: company.legalName,
      title: `${title} — ${company.legalName}`,
      description,
      url: hasDomain ? path : undefined,
      images: [ogImage],
    },
  };
}
