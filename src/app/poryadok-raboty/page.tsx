import Link from "next/link";
import { faq, paymentInfo } from "@/config/content";
import { services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { showDraftContent } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHead } from "@/components/ui/SectionHead";
import { CtaBand } from "@/components/sections/CtaBand";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

export const metadata = pageMetadata({
  title: "Порядок работы",
  description:
    "Как проходит работа с ООО «Интегро»: этапы от обращения до результата, документы для обращения, порядок оплаты и ответы на частые вопросы об оценке и судебной экспертизе.",
  path: "/poryadok-raboty",
});

const sectionNav = [
  { label: "Этапы", href: "#etapy" },
  { label: "Документы", href: "#dokumenty" },
  { label: "Оплата", href: "#oplata" },
  { label: "Вопросы и ответы", href: "#voprosy" },
];

export default function ProcessPage() {
  return (
    <>
      <PageHeader
        title="Порядок работы"
        crumbs={[{ label: "Порядок работы" }]}
        lead="Условия работы согласуются до её начала: что исследуется, какие документы нужны, в какие сроки и на каких условиях будет получен результат."
      >
        <nav aria-label="Разделы страницы" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {sectionNav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="inline-flex rounded-full bg-mist px-4 py-2 text-[0.875rem] text-body transition-colors hover:bg-mist-deep hover:text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      {/* Этапы — на тёмной панели: последовательность передают номера. */}
      <section id="etapy" aria-labelledby="steps-title" className="container-page mt-20 scroll-mt-10 lg:mt-24">
        <div className="panel bg-dark px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <SectionHead id="steps-title" eyebrow="Этапы" title="От обращения до результата" tone="dark" />
          <div className="mt-12">
            <ProcessSteps tone="dark" />
          </div>
        </div>
      </section>

      {/* Документы по направлениям — три белые колонки. */}
      <section id="dokumenty" aria-labelledby="docs-title" className="container-page mt-20 scroll-mt-10 lg:mt-24">
        <SectionHead
          id="docs-title"
          eyebrow="Документы"
          title="Что подготовить к обращению"
          lead="Для первого обращения достаточно описать задачу. Полный перечень документов уточняется после предварительного анализа."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {services.map((service) => (
            <div key={service.slug} className="surface flex flex-col p-6 sm:p-7">
              <h3 className="text-[1.125rem] leading-snug">{service.title}</h3>
              <ul className="mt-5 flex-1 space-y-3 text-[0.9375rem] leading-relaxed">
                {service.prepare.items
                  .filter((item) => showDraftContent || !item.draft)
                  .map((item) => (
                    <li key={item.title} className="flex gap-3">
                      <span aria-hidden="true" className="mt-2.5 h-[2px] w-3 shrink-0 bg-bronze" />
                      {item.title}
                    </li>
                  ))}
              </ul>
              <Link href={`/uslugi/${service.slug}`} className="text-link mt-6 self-start text-[0.875rem]">
                Об услуге
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Оплата и вопросы — асимметричная пара. */}
      <section className="container-page mt-20 lg:mt-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div id="oplata" role="region" aria-labelledby="payment-title" className="scroll-mt-10 lg:col-span-5">
            <SectionHead id="payment-title" eyebrow="Оплата" title={paymentInfo.title} />
            <div className="mt-6 space-y-4 text-[1.0625rem] leading-relaxed">
              {paymentInfo.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div id="voprosy" role="region" aria-labelledby="faq-title" className="scroll-mt-10 lg:col-span-6 lg:col-start-7">
            <SectionHead id="faq-title" eyebrow="Вопросы и ответы" title="Частые вопросы" />
            <div className="mt-8 divide-y divide-line rounded-[var(--radius-card)] bg-white px-6">
              {faq.map((item) => (
                <details key={item.question} className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span aria-hidden="true" className="mt-0.5 text-xl leading-none text-bronze-deep group-open:hidden">
                      +
                    </span>
                    <span aria-hidden="true" className="mt-0.5 hidden text-xl leading-none text-bronze-deep group-open:inline">
                      −
                    </span>
                  </summary>
                  <p className="pb-6 text-[0.9375rem] leading-relaxed text-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
