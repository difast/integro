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
    <nav aria-label="Основная навигация" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-4 py-2 text-[0.97rem] font-bold transition-colors ${
                  active ? "text-accent" : "text-ink hover:text-accent"
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
};

export function MobileMenu({ items, phone, email }: MobileMenuProps) {
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

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-navy-900/15 text-ink transition-colors hover:border-navy-900/40"
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="fixed inset-x-0 top-[76px] bottom-0 z-40 overflow-y-auto border-t border-line bg-white"
      >
        <nav aria-label="Мобильная навигация" className="container-page py-6">
          <ul className="divide-y divide-line">
            <li>
              <Link
                href="/"
                aria-current={pathname === "/" ? "page" : undefined}
                className="block py-4 text-xl font-extrabold text-ink aria-[current=page]:text-accent"
              >
                Главная
              </Link>
            </li>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="block py-4 text-xl font-extrabold text-ink aria-[current=page]:text-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 space-y-4">
            <Link
              href="/kontakty#zayavka"
              className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 font-bold text-white hover:bg-accent-hover"
            >
              Оставить заявку
            </Link>
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="block text-lg font-bold text-ink">
                {phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="block font-semibold text-navy-700">
                {email}
              </a>
            ) : null}
          </div>
        </nav>
      </div>
    </div>
  );
}
