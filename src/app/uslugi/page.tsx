import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { PageHeader } from "@/components/layout/PageHeader";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
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
        <ul className="divide-y divide-line border-y border-line">
          {services.map((service, index) => (
            <li key={service.slug}>
              <Link
                href={`/uslugi/${service.slug}`}
                className="group grid gap-6 py-10 transition-colors md:grid-cols-[80px_1fr_auto] md:items-start lg:py-12"
              >
                <span className="text-sm font-extrabold tracking-[0.12em] text-accent tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="max-w-3xl">
                  <div className="flex items-center gap-4">
                    <ServiceIcon name={service.icon} className="h-8 w-8 shrink-0 text-navy-700" />
                    <h2 className="text-2xl font-extrabold transition-colors group-hover:text-accent sm:text-[2rem]">
                      {service.title}
                    </h2>
                  </div>
                  <p className="mt-4 text-lg leading-relaxed text-muted">{service.summary}</p>
                  <p className="mt-5 text-sm font-semibold text-ink">
                    Итоговый документ: <span className="text-navy-700">{service.result.title}</span>
                  </p>
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-navy-900/15 text-ink transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                  <ArrowRight aria-hidden="true" className="h-5 w-5" />
                  <span className="sr-only">Подробнее об услуге «{service.title}»</span>
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
