import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { faq, paymentInfo } from "@/config/content";
import { services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { showDraftContent } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
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
                  className="inline-flex rounded-full border-2 border-navy-900/15 bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-navy-900/40"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      <section id="etapy" aria-labelledby="steps-title" className="container-page py-16 lg:py-24">
        <SectionHeading id="steps-title" eyebrow="Этапы" title="От обращения до результата" />
        <div className="mt-12">
          <ProcessSteps />
        </div>
      </section>

      <section id="dokumenty" aria-labelledby="docs-title" className="bg-paper py-16 lg:py-24">
        <div className="container-page">
          <SectionHeading
            id="docs-title"
            eyebrow="Документы"
            title="Что подготовить к обращению"
            lead="Для первого обращения достаточно описать задачу. Полный перечень документов уточняется после предварительного анализа."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {services.map((service) => (
              <div key={service.slug} className="reveal flex flex-col rounded-[var(--radius-card)] bg-white p-8">
                <h3 className="text-xl font-extrabold">{service.title}</h3>
                <p className="mt-1 text-sm font-semibold text-accent">{service.prepare.heading}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {service.prepare.items
                    .filter((item) => showDraftContent || !item.draft)
                    .map((item) => (
                      <li key={item.title} className="flex gap-3 leading-relaxed text-body">
                        <span aria-hidden="true" className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        {item.title}
                      </li>
                    ))}
                </ul>
                <Link href={`/uslugi/${service.slug}`} className="link-underline mt-8 self-start text-sm font-bold text-ink">
                  Об услуге
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="oplata" aria-labelledby="payment-title" className="container-page py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <SectionHeading id="payment-title" eyebrow="Оплата" title={paymentInfo.title} />
          <div className="space-y-5 text-lg leading-relaxed lg:pt-10">
            {paymentInfo.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section id="voprosy" aria-labelledby="faq-title" className="border-t border-line py-16 lg:py-24">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <SectionHeading id="faq-title" eyebrow="Вопросы и ответы" title="Частые вопросы" />
          <div className="divide-y divide-line border-y border-line">
            {faq.map((item) => (
              <details key={item.question} className="group py-2">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 rounded py-4 text-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown
                    aria-hidden="true"
                    className="mt-1 h-5 w-5 shrink-0 text-accent transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="pb-5 leading-relaxed text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
