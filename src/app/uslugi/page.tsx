import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { PageHeader } from "@/components/layout/PageHeader";
import { CtaBand } from "@/components/sections/CtaBand";

export const metadata = pageMetadata({
  title: "Услуги",
  description:
    "Услуги ООО «Интегро»: оценочная деятельность с подготовкой отчёта об оценке, судебная экспертиза по определению суда и внесудебные экспертные исследования.",
  path: "/uslugi",
});

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Услуги"
        crumbs={[{ label: "Услуги" }]}
        lead="Оценка стоимости, судебная экспертиза и экспертные исследования. Для каждого направления — свой итоговый документ и порядок работы."
      />

      <section aria-label="Направления деятельности" className="container-page py-16 lg:py-24">
        <ul className="border-t border-ink">
          {services.map((service, index) => (
            <li key={service.slug} className="border-b border-line">
              <Link
                href={`/uslugi/${service.slug}`}
                className="group grid gap-4 py-10 lg:grid-cols-12 lg:gap-8 lg:py-12"
              >
                <span className="text-[0.875rem] font-medium text-accent tabular-nums lg:col-span-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="lg:col-span-7">
                  <h2 className="text-[1.5rem] leading-snug group-hover:underline group-hover:decoration-accent group-hover:underline-offset-[6px] sm:text-[1.75rem]">
                    {service.title}
                  </h2>
                  <p className="mt-4 max-w-[40rem] text-[1.0625rem] leading-relaxed text-muted">{service.summary}</p>
                  <p className="mt-5 text-[0.875rem] text-muted">
                    Итоговый документ: <span className="font-medium text-ink">{service.result.title}</span>
                  </p>
                </div>
                <span className="hidden items-start justify-end lg:col-span-2 lg:flex">
                  <span className="inline-flex h-11 w-11 items-center justify-center border border-line-strong text-ink transition-colors group-hover:border-navy-900 group-hover:bg-navy-900 group-hover:text-white">
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <CtaBand />
    </>
  );
}
