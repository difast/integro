"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Заявки" },
  { href: "/admin/max", label: "MAX — обращения" },
  { href: "/admin/statistika", label: "Статистика" },
];

/** Разделы панели. Раздел «Заявки» активен и на карточке заявки. */
export function AdminNav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/zayavki") : pathname.startsWith(href);

  return (
    <nav aria-label="Разделы панели" className="border-b border-line bg-white">
      <ul className="container-page flex gap-6 overflow-x-auto">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className="inline-flex min-h-12 items-center border-b-2 whitespace-nowrap border-transparent text-[0.9375rem] font-medium text-muted transition-colors hover:text-ink aria-[current=page]:border-bronze aria-[current=page]:text-ink"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
