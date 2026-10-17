"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { FilterTabs } from "@/components/ui/FilterTabs";

type BrowserService = {
  slug: string;
  title: string;
  summary: string;
  resultTitle: string;
  audiences: string[];
};

/** Каталог услуг: вкладки по типу заказчика и сетка карточек. */
export function ServicesBrowser({
  services,
  audiences,
}: {
  services: BrowserService[];
  audiences: { key: string; label: string }[];
}) {
  const requested = useSearchParams().get("dlya");
  const [active, setActive] = useState(
    requested && audiences.some((a) => a.key === requested) ? requested : "all",
  );
  const visible = active === "all" ? services : services.filter((s) => s.audiences.includes(active));

  return (
    <div>
      <FilterTabs
        tabs={[{ key: "all", label: "Все услуги" }, ...audiences]}
        active={active}
        onChange={setActive}
        label="Кому подходит услуга"
      />
      <ul className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
        {visible.map((service) => (
          <li key={service.slug}>
            <Link
              href={`/uslugi/${service.slug}`}
              className="group flex h-full min-h-[280px] flex-col rounded-[var(--radius-card)] bg-white p-7 transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(38,55,70,0.45)]"
            >
              <h2 className="text-[1.375rem] leading-snug group-hover:underline group-hover:decoration-bronze group-hover:underline-offset-[5px]">
                {service.title}
              </h2>
              <p className="mt-4 flex-1 text-[0.9375rem] leading-relaxed text-muted">{service.summary}</p>
              <div className="mt-6 flex items-end justify-between gap-4">
                <p className="text-[0.8125rem] text-muted">
                  Итоговый документ:
                  <span className="mt-0.5 block font-medium text-ink">{service.resultTitle}</span>
                </p>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dark text-white transition-colors group-hover:bg-bronze group-hover:text-dark">
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
