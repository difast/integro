import type { ReactNode } from "react";
import { services } from "@/config/services";
import { servicePages } from "@/config/service-pages";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AttributionCapture } from "@/components/layout/AttributionCapture";
import { CookieNotice } from "@/components/layout/CookieNotice";
import { RequestModalProvider } from "@/components/request/RequestModal";

// Направления формы и соответствие страниц услуг направлениям — для всплывающей формы.
const serviceOptions = services.map((service) => ({ value: service.slug, label: service.title }));
const serviceMap: Record<string, string> = {
  ...Object.fromEntries(services.map((service) => [service.slug, service.slug])),
  ...Object.fromEntries(servicePages.map((page) => [page.slug, page.formService])),
};

/** Шапка, подвал, уведомление о cookie и всплывающая форма заявки публичной части сайта. */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <RequestModalProvider services={serviceOptions} serviceMap={serviceMap}>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <CookieNotice />
      <AttributionCapture />
    </RequestModalProvider>
  );
}
