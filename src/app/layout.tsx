import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { company } from "@/config/company";
import { getMetadataBase, getSiteUrl } from "@/lib/site";
import { ogImage } from "@/lib/metadata";

// IBM Plex Sans (SIL OFL 1.1), локальные файлы: латиница и кириллица подключаются
// отдельными начертаниями с unicode-range, без запросов к внешним сервисам.
const plexLatin = localFont({
  src: "../fonts/ibm-plex-sans-latin-wght-normal.woff2",
  weight: "100 700",
  display: "swap",
  variable: "--font-plex-latin",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});

const plexCyrillic = localFont({
  src: "../fonts/ibm-plex-sans-cyrillic-wght-normal.woff2",
  weight: "100 700",
  display: "swap",
  variable: "--font-plex-cyrillic",
  declarations: [{ prop: "unicode-range", value: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" }],
});

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
  themeColor: "#263746",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${plexLatin.variable} ${plexCyrillic.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-[var(--radius-control)] bg-dark px-5 py-3 font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Перейти к содержанию
        </a>
        {children}
      </body>
    </html>
  );
}
