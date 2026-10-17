import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { clientLinks } from "@/config/content";
import { audienceLabels, getServiceDetails, type AudienceKey } from "@/config/service-details";
import { services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { PageHeader } from "@/components/layout/PageHeader";
import { CtaBand } from "@/components/sections/CtaBand";
import { ServicesBrowser } from "@/components/sections/ServicesBrowser";
import { SectionHead } from "@/components/ui/SectionHead";

export const metadata = pageMetadata({
  title: "Услуги",
  description:
    "Услуги ООО «Интегро»: оценочная деятельность с подготовкой отчёта об оценке, судебная экспертиза по определению суда и внесудебные экспертные исследования.",
  path: "/uslugi",
});

export default function ServicesPage() {
  const items = services.map((service) => ({
    slug: service.slug,
    title: service.title,
    summary: service.summary,
    resultTitle: service.result.title,
    audiences: getServiceDetails(service.slug)?.audiences ?? [],
  }));
  const audiences = (Object.keys(audienceLabels) as AudienceKey[]).map((key) => ({ key, label: audienceLabels[key] }));

  return (
    <>
      <PageHeader
        title="Услуги"
        crumbs={[{ label: "Услуги" }]}
        lead="Оценка стоимости, судебная экспертиза и экспертные исследования. Для каждого направления — свой итоговый документ и порядок работы."
      />

      <div className="container-page mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-8">
        <aside className="order-2 min-w-0 space-y-8 self-start rounded-[var(--radius-card)] bg-white p-6 lg:order-1 lg:col-span-3">
          <nav aria-labelledby="dir-title">
            <h2 id="dir-title" className="text-[0.875rem] font-medium text-muted">
              Направления
            </h2>
            <ul className="mt-4 border-t border-line">
              {services.map((service) => (
                <li key={service.slug} className="border-b border-line">
                  <Link
                    href={`/uslugi/${service.slug}`}
                    className="group flex items-center justify-between gap-3 py-3.5 font-medium text-ink"
                  >
                    <span className="group-hover:underline group-hover:decoration-bronze group-hover:underline-offset-4">
                      {service.title}
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted group-hover:text-bronze-deep" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="clients-title">
            <h2 id="clients-title" className="text-[0.875rem] font-medium text-muted">
              Клиентам
            </h2>
            <ul className="mt-4 space-y-3 border-t border-line pt-4 text-[0.9375rem]">
              {[...clientLinks, { label: "Статьи", href: "/stati" }].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section aria-label="Каталог услуг" className="order-1 min-w-0 lg:order-2 lg:col-span-9">
          <Suspense fallback={null}>
            <ServicesBrowser services={items} audiences={audiences} />
          </Suspense>
        </section>
      </div>

      <section aria-labelledby="compare-title" className="container-page mt-20 lg:mt-24">
        <div className="panel bg-white px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-4">
              <SectionHead id="compare-title" eyebrow="Как выбрать" title="Чем отличаются направления" />
            </div>
            <div className="min-w-0 lg:col-span-8">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-[0.9375rem]">
                  <thead>
                    <tr className="border-b-2 border-dark">
                      <th scope="col" className="py-3 pr-4 font-semibold text-ink">
                        Направление
                      </th>
                      <th scope="col" className="py-3 pr-4 font-semibold text-ink">
                        Основание
                      </th>
                      <th scope="col" className="py-3 pr-4 font-semibold text-ink">
                        Итоговый документ
                      </th>
                      <th scope="col" className="py-3 font-semibold text-ink">
                        Кому
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service) => {
                      const details = getServiceDetails(service.slug);
                      return (
                        <tr key={service.slug} className="border-b border-line align-top">
                          <th scope="row" className="py-4 pr-4 font-medium">
                            <Link href={`/uslugi/${service.slug}`} className="text-link">
                              {service.title}
                            </Link>
                          </th>
                          <td className="py-4 pr-4 text-body">{details?.startsWith}</td>
                          <td className="py-4 pr-4 text-body">{service.result.title}</td>
                          <td className="py-4 text-body">
                            {details?.audiences.map((a) => audienceLabels[a]).join(", ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-6 text-[0.9375rem] text-muted">
                Подробно о различиях — в статье{" "}
                <Link href="/stati/otchet-ob-ocenke-i-zaklyuchenie-eksperta" className="text-link">
                  «Отчёт об оценке и заключение эксперта: в чём разница»
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
