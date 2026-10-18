import Link from "next/link";
import { ArrowRight, Compass, FileText, Scale } from "lucide-react";
import { getService, services } from "@/config/services";
import { getServicePage, type ServicePage } from "@/config/service-pages";
import { articleCategories, getArticles } from "@/lib/articles";
import { breadcrumbJsonLd, JsonLd } from "@/lib/structured-data";
import { PageHeader, type Crumb } from "@/components/layout/PageHeader";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SectionHead } from "@/components/ui/SectionHead";
import { CtaBand } from "@/components/sections/CtaBand";
import { RequestButton } from "@/components/request/RequestButton";

const factIcons = [FileText, Compass, Scale];

/** Ссылка на любую страницу услуги: базовое направление или отдельная страница. */
function serviceLink(slug: string): { href: string; title: string; summary: string } | null {
  const page = getServicePage(slug);
  if (page) return { href: `/uslugi/${page.slug}`, title: page.shortTitle, summary: page.summary };
  const base = getService(slug);
  return base ? { href: `/uslugi/${base.slug}`, title: base.title, summary: base.summary } : null;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="relative pl-6 text-body">
          <span aria-hidden="true" className="absolute top-[0.8em] left-0 h-[2px] w-3 bg-bronze" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Отдельная страница по виду оценки или экспертизы. */
export function ServicePageView({ page }: { page: ServicePage }) {
  const parent = page.parent ? services.find((service) => service.slug === page.parent) : undefined;
  const crumbs: Crumb[] = [
    { label: "Услуги", href: "/uslugi" },
    ...(parent ? [{ label: parent.title, href: `/uslugi/${parent.slug}` }] : []),
    { label: page.shortTitle },
  ];
  const path = `/uslugi/${page.slug}`;
  const articles = getArticles()
    .filter((article) => article.services.some((s) => page.articleServices.includes(s as never)))
    .slice(0, 3)
    .map((article) => ({ ...article, categoryLabel: articleCategories[article.category] }));
  const related = page.related.map(serviceLink).filter((link) => link !== null);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs, path)} />

      <PageHeader
        title={page.title}
        crumbs={crumbs}
        lead={page.lead}
        aside={
          <ul className="space-y-3" aria-label="Ключевые сведения">
            {page.facts.map((fact, index) => {
              const Icon = factIcons[index % factIcons.length]!;
              return (
                <li key={fact.label} className="flex gap-4 rounded-[var(--radius-card)] bg-mist p-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-dark">
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block text-[0.8125rem] text-muted">{fact.label}</span>
                    <span className="mt-0.5 block font-medium text-ink">{fact.value}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        }
      >
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <RequestButton href={`/kontakty?usluga=${page.slug}#zayavka`}>
            Оставить заявку
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </RequestButton>
          <Link href="/kakoy-dokument-nuzhen" className="text-link text-[0.9375rem]">
            Не уверены, какой документ нужен?
          </Link>
        </div>
      </PageHeader>

      <section aria-labelledby="situations-title" className="container-page mt-20 lg:mt-24">
        <SectionHead id="situations-title" eyebrow="Ситуации" title={page.situationsTitle} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.situations.map((item) => (
            <li key={item.title} className="surface p-6 sm:p-7">
              <span aria-hidden="true" className="block h-[2px] w-8 bg-bronze" />
              <h3 className="mt-5 text-[1.125rem]">{item.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {page.blocks.map((block, index) => (
        <section key={block.id} id={block.id} aria-labelledby={`${block.id}-title`} className="container-page mt-20 scroll-mt-10 lg:mt-24">
          <div className={`grid gap-8 lg:grid-cols-12 ${index % 2 === 1 ? "panel bg-white p-6 sm:p-10 lg:p-12" : ""}`}>
            <div className="lg:col-span-4">
              <SectionHead id={`${block.id}-title`} eyebrow={block.eyebrow} title={block.title} />
            </div>
            <div className="min-w-0 lg:col-span-7 lg:col-start-6">
              {block.paragraphs?.length ? (
                <div className="prose-text text-body">
                  {block.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
                </div>
              ) : null}
              {block.list?.length ? <Bullets items={block.list} /> : null}
              {block.subsections?.length ? (
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  {block.subsections.map((sub) => (
                    <div key={sub.title} className={`rounded-[var(--radius-card)] p-6 ${index % 2 === 1 ? "bg-mist" : "bg-white"}`}>
                      <h3 className="text-[1.0625rem]">{sub.title}</h3>
                      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{sub.text}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ))}

      <section aria-labelledby="prepare-title" className="container-page mt-20 lg:mt-24">
        <SectionHead id="prepare-title" eyebrow="Подготовка" title="Что понадобится" />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="surface p-6 sm:p-8">
            <h3 className="text-[1.1875rem]">{page.objectInfo.title}</h3>
            {page.objectInfo.intro ? <p className="mt-3 text-[0.9375rem] text-muted">{page.objectInfo.intro}</p> : null}
            <Bullets items={page.objectInfo.items} />
          </div>
          <div className="surface p-6 sm:p-8">
            <h3 className="text-[1.1875rem]">{page.documents.title}</h3>
            <p className="mt-3 text-[0.9375rem] text-muted">{page.documents.intro}</p>
            <Bullets items={page.documents.items} />
          </div>
        </div>
      </section>

      <section id="poryadok" aria-labelledby="steps-title" className="container-page mt-20 scroll-mt-10 lg:mt-24">
        <SectionHead
          id="steps-title"
          eyebrow="Порядок"
          title="Как в общем виде проходит работа"
          action={
            <Link href="/poryadok-raboty" className="text-link text-[0.9375rem]">
              Общие условия и оплата
            </Link>
          }
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {page.steps.map((step, index) => (
            <li key={step.title} className="surface p-6">
              <span className="text-[2.25rem] leading-none font-light text-steel tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-6 text-[1.0625rem]">{step.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="factors-title" className="container-page mt-20 lg:mt-24">
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="panel bg-dark p-6 text-white sm:p-10 lg:col-span-5">
            <SectionHead id="factors-title" eyebrow="Стоимость и сроки" title={page.factors.title} tone="dark" />
            <p className="mt-6 text-[0.9375rem] leading-relaxed text-on-dark">{page.factors.intro}</p>
            <ul className="mt-6 space-y-3">
              {page.factors.items.map((item) => (
                <li key={item} className="relative pl-6 text-on-dark">
                  <span aria-hidden="true" className="absolute top-[0.8em] left-0 h-[2px] w-3 bg-bronze" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel bg-white p-6 sm:p-10 lg:col-span-7">
            <SectionHead id="differences-title" eyebrow="Отличия" title={page.differences.title} />
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {page.differences.items.map((item) => (
                <li key={item.title} className="py-5">
                  <h3 className="text-[1.0625rem]">
                    {item.href ? (
                      <Link href={item.href} className="text-link">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="container-page mt-20 lg:mt-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div aria-labelledby="faq-title" role="region" className="lg:col-span-7">
            <SectionHead id="faq-title" eyebrow="Вопросы" title="Частые вопросы" />
            <div className="mt-8 divide-y divide-line rounded-[var(--radius-card)] bg-white px-6">
              {page.faq.map((item) => (
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
          <aside aria-label="Полезные материалы" className="space-y-4 lg:col-span-4 lg:col-start-9 lg:pt-14">
            {page.lawyers ? (
              <Link
                href={`/dlya-yuristov#${page.lawyers.anchor}`}
                className="group block rounded-[var(--radius-card)] border-t-[3px] border-bronze bg-white p-6"
              >
                <span className="text-[0.8125rem] font-medium text-muted">Для юристов</span>
                <span className="mt-2 block font-medium text-ink group-hover:text-bronze-deep">{page.lawyers.text}</span>
              </Link>
            ) : null}
            <Link href="/kakoy-dokument-nuzhen" className="group block rounded-[var(--radius-card)] bg-white p-6">
              <span className="text-[0.8125rem] font-medium text-muted">Помощник</span>
              <span className="mt-2 block font-medium text-ink group-hover:text-bronze-deep">
                Какой документ мне нужен? Ответьте на несколько вопросов
              </span>
            </Link>
          </aside>
        </div>
      </section>

      <CtaBand service={page.slug} />

      {articles.length > 0 ? (
        <section aria-labelledby="articles-title" className="container-page mt-20 lg:mt-24">
          <SectionHead id="articles-title" eyebrow="Статьи" title="Статьи по теме" />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug}>
                <ArticleCard article={article} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="related-title" className="container-page mt-20 lg:mt-24">
        <SectionHead id="related-title" eyebrow="Услуги" title="Связанные услуги" />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {related.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="group flex h-full flex-col justify-between gap-6 rounded-[var(--radius-card)] border-t-[3px] border-bronze bg-white p-7"
              >
                <span>
                  <span className="block text-[1.25rem] leading-snug font-medium text-ink">{link.title}</span>
                  <span className="mt-3 block text-[0.9375rem] leading-relaxed text-muted">{link.summary}</span>
                </span>
                <span className="inline-flex h-11 w-11 items-center justify-center self-end rounded-full bg-mist text-ink transition-colors group-hover:bg-dark group-hover:text-white">
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
