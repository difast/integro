import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { company } from "@/config/company";
import { getMetadataBase, getSiteUrl } from "@/lib/site";
import { ogImage } from "@/lib/metadata";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

const defaultTitle = `${company.legalName} — оценочная деятельность и судебная экспертиза`;
const defaultDescription =
  "ООО «Интегро»: оценка стоимости с подготовкой отчёта об оценке, проведение судебных экспертиз по определению суда и внесудебные экспертные исследования.";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: defaultTitle,
    template: `%s — ${company.legalName}`,
  },
  description: defaultDescription,
  applicationName: company.legalName,
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: company.legalName,
    title: defaultTitle,
    description: defaultDescription,
    images: [ogImage],
  },
  twitter: { card: "summary_large_image" },
  // Пока домен не задан, сайт не индексируется (защита от индексации тестовых адресов).
  robots: getSiteUrl() ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111f47",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-navy-900 px-5 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Перейти к содержанию
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
