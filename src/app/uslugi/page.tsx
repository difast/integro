import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clientLinks } from "@/config/content";
import { audienceLabels, getServiceDetails, type AudienceKey } from "@/config/service-details";
import { services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { PageHeader } from "@/components/layout/PageHeader";
import { CtaBand } from "@/components/sections/CtaBand";
import { ServicesBrowser } from "@/components/sections/ServicesBrowser";

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

      <div className="container-page grid gap-12 py-12 lg:grid-cols-12 lg:gap-8 lg:py-20">
        <aside className="order-2 space-y-10 lg:order-1 lg:col-span-3">
          <nav aria-labelledby="dir-title">
            <h2 id="dir-title" className="label">
              Направления
            </h2>
            <ul className="mt-4 border-t border-line">
              {services.map((service) => (
                <li key={service.slug} className="border-b border-line">
                  <Link
                    href={`/uslugi/${service.slug}`}
                    className="group flex items-center justify-between gap-3 py-3.5 font-medium text-ink"
                  >
                    <span className="group-hover:underline group-hover:decoration-accent group-hover:underline-offset-4">
                      {service.title}
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="clients-title">
            <h2 id="clients-title" className="label">
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

        <section aria-label="Каталог услуг" className="order-1 lg:order-2 lg:col-span-9">
          <ServicesBrowser services={items} audiences={audiences} />
        </section>
      </div>

      <section aria-labelledby="compare-title" className="bg-paper">
        <div className="container-page py-16 lg:py-20">
          <div className="grid gap-6 border-t border-ink pt-6 lg:grid-cols-12 lg:gap-8">
            <p className="label lg:col-span-3">Как выбрать</p>
            <div className="lg:col-span-9">
              <h2 id="compare-title" className="h-section">
                Чем отличаются направления
              </h2>
              <div className="mt-8 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-[0.9375rem]">
                  <thead>
                    <tr className="border-b-2 border-ink">
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
