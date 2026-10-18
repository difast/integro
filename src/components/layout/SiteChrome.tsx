import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CookieNotice } from "@/components/layout/CookieNotice";

/** Шапка, подвал и уведомление о cookie публичной части сайта. */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <CookieNotice />
    </>
  );
}
