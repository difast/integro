import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { isAdmin } from "@/lib/admin/auth";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: { default: "Заявки", template: "%s — панель заявок" },
  robots: { index: false, follow: false, nocache: true },
};

// Админка всегда рендерится на сервере по запросу и не кешируется.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const signedIn = await isAdmin();

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="container-page flex min-h-16 items-center justify-between gap-4">
          <Link href="/admin" className="inline-flex items-center gap-3">
            <LogoMark className="h-8 w-auto" />
            <span className="leading-tight">
              <span className="block text-[0.9375rem] font-medium text-ink">Панель заявок</span>
              <span className="block text-[0.75rem] text-muted">ООО «Интегро»</span>
            </span>
          </Link>
          {signedIn ? (
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong px-4 text-[0.875rem] font-medium text-ink transition-colors hover:border-dark"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Выйти
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <main id="main" className="flex-1 pb-16">
        {children}
      </main>
    </>
  );
}
