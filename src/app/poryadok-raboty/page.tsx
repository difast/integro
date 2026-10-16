import Link from "next/link";
import { faq, paymentInfo } from "@/config/content";
import { services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { showDraftContent } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/ui/Section";
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
        <nav aria-label="Разделы страницы" className="mt-9">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
            {sectionNav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      <Section id="steps-title" anchor="etapy" index="01" label="Этапы" title="От обращения до результата">
        <ProcessSteps />
      </Section>

      <Section
        id="docs-title"
        anchor="dokumenty"
        index="02"
        label="Документы"
        title="Что подготовить к обращению"
        lead="Для первого обращения достаточно описать задачу. Полный перечень документов уточняется после предварительного анализа."
        tone="paper"
      >
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {services.map((service) => (
            <div key={service.slug} className="border-t border-ink pt-5">
              <h3 className="text-[1.0625rem] leading-snug">{service.title}</h3>
              <ul className="mt-4 space-y-2.5 text-[0.9375rem] leading-relaxed">
                {service.prepare.items
                  .filter((item) => showDraftContent || !item.draft)
                  .map((item) => (
                    <li key={item.title} className="grid grid-cols-[1rem_1fr]">
                      <span aria-hidden="true" className="text-accent">
                        —
                      </span>
                      {item.title}
                    </li>
                  ))}
              </ul>
              <Link href={`/uslugi/${service.slug}`} className="text-link mt-5 inline-block text-[0.875rem]">
                Об услуге
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Section id="payment-title" anchor="oplata" index="03" label="Оплата" title={paymentInfo.title}>
        <div className="prose-text">
          {paymentInfo.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
      </Section>

      <Section id="faq-title" anchor="voprosy" index="04" label="Вопросы и ответы" title="Частые вопросы" tone="paper">
        <div className="border-t border-line">
          {faq.map((item) => (
            <details key={item.question} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[1.0625rem] font-medium text-ink [&::-webkit-details-marker]:hidden">
                {item.question}
                <span aria-hidden="true" className="mt-0.5 text-xl leading-none text-accent group-open:hidden">
                  +
                </span>
                <span aria-hidden="true" className="mt-0.5 hidden text-xl leading-none text-accent group-open:inline">
                  −
                </span>
              </summary>
              <p className="max-w-[68ch] pb-6 text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
