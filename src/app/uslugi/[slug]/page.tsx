import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileCheck2, FileText, Scale } from "lucide-react";
import { audienceLabels, getServiceDetails } from "@/config/service-details";
import { getService, services } from "@/config/services";
import { articleCategories, getArticlesForService } from "@/lib/articles";
import { pageMetadata } from "@/lib/metadata";
import { showDraftContent } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { ButtonLink } from "@/components/ui/Button";
import { DraftBadge } from "@/components/ui/DraftBadge";
import { Section } from "@/components/ui/Section";
import { CtaBand } from "@/components/sections/CtaBand";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  return pageMetadata({ title: service.title, description: service.metaDescription, path: `/uslugi/${slug}` });
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = getService(slug);
  const details = getServiceDetails(slug);
  if (!service || !details) notFound();

  const scope = service.scope
    .map((group) => ({ ...group, items: group.items.filter((item) => showDraftContent || !item.draft) }))
    .filter((group) => group.items.length > 0);
  const prepare = service.prepare.items.filter((item) => showDraftContent || !item.draft);
  const others = services.filter((item) => item.slug !== service.slug);
  const articles = getArticlesForService(slug).map((a) => ({ ...a, categoryLabel: articleCategories[a.category] }));

  const facts = [
    { icon: FileCheck2, title: "Основание", text: details.startsWith },
    { icon: FileText, title: "Итоговый документ", text: service.result.title },
    { icon: Scale, title: "Правовая основа", text: service.basis.map((b) => b.code).join(" · ") },
  ];

  // Нумерация разделов следует за фактически показанными блоками.
  let n = 0;
  const next = () => String(++n).padStart(2, "0");

  return (
    <>
      <PageHeader
        title={service.title}
        crumbs={[{ label: "Услуги", href: "/uslugi" }, { label: service.title }]}
        lead={service.lead}
      >
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Кому подходит">
          {details.audiences.map((a) => (
            <li key={a} className="border border-line-strong bg-white px-3 py-1.5 text-[0.8125rem] font-medium text-ink">
              {audienceLabels[a]}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={`/kontakty?usluga=${service.slug}#zayavka`}>
            Оставить заявку
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink href="#poryadok" variant="outline">
            Как проходит работа
          </ButtonLink>
        </div>
      </PageHeader>

      {/* Ключевые сведения об услуге */}
      <section aria-label="Ключевые сведения" className="container-page pt-12 lg:pt-16">
        <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
          {facts.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col bg-paper p-6 sm:p-7">
              <span className="inline-flex h-12 w-12 items-center justify-center bg-white text-navy-900">
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="label mt-8">{title}</p>
              <p className="mt-2 text-[1.125rem] leading-snug font-semibold text-ink">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <Section id="task-title" index={next()} label="Задача" title="Зачем нужна услуга" lead={details.task}>
        <div className="prose-text">
          {service.about.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
      </Section>

      <Section id="situations-title" index={next()} label="Ситуации" title={details.situationsHeading} tone="paper">
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {details.situations.map((s) => (
            <li key={s.title} className="border-t border-line py-6">
              <h3 className="text-[1.125rem]">{s.title}</h3>
              <p className="mt-2 text-muted">{s.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="work-title" index={next()} label="Состав работ" title="Что входит в работу">
        <ol className="grid gap-x-8 border-t border-line sm:grid-cols-2">
          {details.work.map((item, index) => (
            <li key={item} className="grid grid-cols-[2.5rem_1fr] border-b border-line py-4">
              <span className="text-[0.875rem] font-medium text-accent tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-ink">{item}</span>
            </li>
          ))}
        </ol>
        {scope.map((group) => (
          <div key={group.heading} className="mt-10">
            <h3 className="text-[1.125rem]">{group.heading}</h3>
            <ul className="mt-4 grid gap-x-8 border-t border-line sm:grid-cols-2">
              {group.items.map((item) => (
                <li key={item.title} className="border-b border-line py-3 text-ink">
                  {item.title}
                  {item.draft ? <DraftBadge /> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mt-10 border-t-[3px] border-navy-900 bg-paper p-6 sm:p-7">
          <p className="label">Итоговый документ</p>
          <p className="mt-2 text-[1.25rem] font-semibold text-ink">{service.result.title}</p>
          <p className="mt-2 max-w-[44rem] text-muted">{service.result.text}</p>
        </div>
      </Section>

      <Section id="steps-title" anchor="poryadok" index={next()} label="Порядок" title="Как проходит работа" tone="paper">
        <ol className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {details.steps.map((step, index) => (
            <li key={step.title} className="bg-paper py-6 sm:pr-6 lg:py-2">
              <span className="text-[0.875rem] font-medium text-accent tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-[1.0625rem]">{step.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[0.9375rem] text-muted">
          Общие условия, оплата и документы —{" "}
          <Link href="/poryadok-raboty" className="text-link">
            на странице «Порядок работы»
          </Link>
          .
        </p>
      </Section>

      <Section
        id="prepare-title"
        index={next()}
        label="Документы"
        title={service.prepare.heading}
        lead={service.prepare.intro}
      >
        <ul className="grid gap-x-8 border-t border-line sm:grid-cols-2">
          {prepare.map((item) => (
            <li key={item.title} className="grid grid-cols-[1.25rem_1fr] border-b border-line py-3.5 text-ink">
              <span aria-hidden="true" className="text-accent">
                —
              </span>
              {item.title}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <p className="label">Правовая основа</p>
          <dl className="mt-4 grid gap-x-8 border-t border-line sm:grid-cols-2">
            {service.basis.map((item) => (
              <div key={item.code} className="border-b border-line py-4">
                <dt className="font-medium text-ink">{item.code}</dt>
                <dd className="mt-1 text-[0.875rem] leading-relaxed text-muted">{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section id="faq-title" index={next()} label="Вопросы" title="Частые вопросы" tone="paper">
        <div className="border-t border-line">
          {details.faq.map((item) => (
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

      <CtaBand service={service.slug} />

      {articles.length > 0 ? (
        <section aria-labelledby="articles-title" className="container-page py-16 lg:py-20">
          <div className="flex flex-col gap-6 border-t border-ink pt-6 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="articles-title" className="h-section">
              Статьи по теме
            </h2>
            <ButtonLink href="/stati" variant="outline">
              Все статьи
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <ArticleCard article={a} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="other-title" className="bg-paper">
        <div className="container-page py-16 lg:py-20">
          <div className="flex flex-col gap-6 border-t border-ink pt-6 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="other-title" className="h-section">
              Другие услуги
            </h2>
            <ButtonLink href="/uslugi" variant="outline">
              Все услуги
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-x-8 md:grid-cols-2">
            {others.map((item) => (
              <li key={item.slug} className="border-t border-line-strong">
                <Link href={`/uslugi/${item.slug}`} className="group block py-6">
                  <span className="block text-[1.375rem] leading-snug font-semibold text-navy-900 group-hover:text-accent">
                    {item.title}
                  </span>
                  <span className="mt-3 block max-w-[34rem] text-[0.9375rem] leading-relaxed text-muted">
                    {item.summary}
                  </span>
                  <span className="mt-5 inline-flex items-center gap-2 text-[0.875rem] font-medium text-ink">
                    Подробнее
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
