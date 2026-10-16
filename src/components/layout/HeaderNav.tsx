"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import type { NavItem } from "@/config/content";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Основная навигация" className="hidden h-full lg:block">
      <ul className="flex h-full items-stretch gap-8">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center text-[0.9375rem] font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:transition-colors ${
                  active ? "text-ink after:bg-accent" : "text-body after:bg-transparent hover:text-ink hover:after:bg-line-strong"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type MobileMenuProps = {
  items: NavItem[];
  phone: string | null;
  email: string | null;
  workingHours: string | null;
};

export function MobileMenu({ items, phone, email, workingHours }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();

  // Закрываем меню при переходе на другую страницу.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const linkClass =
    "flex items-center justify-between py-4 text-[1.125rem] font-medium text-ink aria-[current=page]:text-accent";

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[2px] border border-line-strong text-ink transition-colors hover:border-ink"
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="fixed inset-x-0 top-[72px] bottom-0 z-40 overflow-y-auto border-t border-line bg-white"
      >
        <nav aria-label="Мобильная навигация" className="container-page py-4">
          <ul className="divide-y divide-line border-b border-line">
            <li>
              <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={linkClass}>
                Главная
              </Link>
            </li>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={linkClass}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 space-y-5">
            <Link
              href="/kontakty#zayavka"
              className="flex min-h-12 w-full items-center justify-center rounded-[2px] bg-navy-900 px-6 font-medium text-white hover:bg-navy-800"
            >
              Оставить заявку
            </Link>
            {workingHours ? (
              <p className="text-[0.875rem] text-muted">
                Часы связи: {workingHours}
              </p>
            ) : null}
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="block text-lg font-medium text-ink">
                {phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="block text-ink underline underline-offset-4">
                {email}
              </a>
            ) : null}
          </div>
        </nav>
      </div>
    </div>
  );
}
