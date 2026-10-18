import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileCheck2, FileText, Scale } from "lucide-react";
import { audienceLabels, getServiceDetails } from "@/config/service-details";
import { getService, services } from "@/config/services";
import { getServicePage, servicePages, servicePagesFor, type BaseServiceSlug } from "@/config/service-pages";
import { articleCategories, getArticlesForService } from "@/lib/articles";
import { pageMetadata } from "@/lib/metadata";
import { showDraftContent } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { ButtonLink } from "@/components/ui/Button";
import { DraftBadge } from "@/components/ui/DraftBadge";
import { SectionHead } from "@/components/ui/SectionHead";
import { CtaBand } from "@/components/sections/CtaBand";
import { RequestButton } from "@/components/request/RequestButton";
import { ServicePageView } from "@/components/sections/ServicePageView";
import { breadcrumbJsonLd, JsonLd } from "@/lib/structured-data";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

// Базовые направления и отдельные страницы по видам оценки и экспертизы.
export function generateStaticParams() {
  return [...services.map((service) => ({ slug: service.slug })), ...servicePages.map((page) => ({ slug: page.slug }))];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (page) return pageMetadata({ title: page.metaTitle, description: page.metaDescription, path: `/uslugi/${slug}` });
  const service = getService(slug);
  if (!service) return {};
  return pageMetadata({ title: service.title, description: service.metaDescription, path: `/uslugi/${slug}` });
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const detailedPage = getServicePage(slug);
  if (detailedPage) return <ServicePageView page={detailedPage} />;

  const service = getService(slug);
  const details = getServiceDetails(slug);
  if (!service || !details) notFound();

  const scope = service.scope
    .map((group) => ({ ...group, items: group.items.filter((item) => showDraftContent || !item.draft) }))
    .filter((group) => group.items.length > 0);
  const prepare = service.prepare.items.filter((item) => showDraftContent || !item.draft);
  const others = services.filter((item) => item.slug !== service.slug);
  const articles = getArticlesForService(slug).map((a) => ({ ...a, categoryLabel: articleCategories[a.category] }));
  const subPages = servicePagesFor(slug as BaseServiceSlug);
  const crumbs = [{ label: "Услуги", href: "/uslugi" }, { label: service.title }];

  const facts = [
    { icon: FileCheck2, title: "Основание", text: details.startsWith },
    { icon: FileText, title: "Итоговый документ", text: service.result.title },
    { icon: Scale, title: "Правовая основа", text: service.basis.map((b) => b.code).join(" · ") },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs, `/uslugi/${service.slug}`)} />
      <PageHeader
        title={service.title}
        crumbs={crumbs}
        lead={service.lead}
        aside={
          <ul className="space-y-3" aria-label="Ключевые сведения">
            {facts.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-[var(--radius-card)] bg-mist p-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-dark">
                  <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block text-[0.8125rem] text-muted">{title}</span>
                  <span className="mt-0.5 block font-medium text-ink">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        }
      >
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Кому подходит">
          {details.audiences.map((a) => (
            <li key={a} className="rounded-full bg-mist px-3.5 py-1.5 text-[0.8125rem] text-body">
              {audienceLabels[a]}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <RequestButton href={`/kontakty?usluga=${service.slug}#zayavka`}>
            Оставить заявку
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </RequestButton>
          <a href="#poryadok" className="text-link text-[0.9375rem]">
            Как проходит работа
          </a>
        </div>
      </PageHeader>

      {/* Задача клиента: крупный текст слева, пояснение справа. */}
      <section aria-labelledby="task-title" className="container-page mt-20 lg:mt-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <SectionHead id="task-title" eyebrow="Задача" title="Зачем нужна услуга" />
            <p className="mt-6 text-[1.25rem] leading-[1.55] text-ink">{details.task}</p>
          </div>
          <div className="prose-text text-body lg:col-span-6 lg:col-start-7 lg:pt-14">
            {service.about.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Ситуации: белые карточки на светлом фоне. */}
      <section aria-labelledby="situations-title" className="container-page mt-20 lg:mt-24">
        <SectionHead id="situations-title" eyebrow="Ситуации" title={details.situationsHeading} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.situations.map((s) => (
            <li key={s.title} className="surface p-6 sm:p-7">
              <span aria-hidden="true" className="block h-[2px] w-8 bg-bronze" />
              <h3 className="mt-5 text-[1.125rem]">{s.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Состав работ и итоговый документ: асимметричная пара. */}
      <section aria-labelledby="work-title" className="container-page mt-20 lg:mt-24">
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="panel bg-white p-6 sm:p-10 lg:col-span-8">
            <SectionHead id="work-title" eyebrow="Состав работ" title="Что входит в работу" />
            <ul className="mt-8 grid gap-x-8 sm:grid-cols-2">
              {details.work.map((item) => (
                <li key={item} className="relative border-b border-line py-4 pl-6 text-ink">
                  <span aria-hidden="true" className="absolute top-[1.55rem] left-0 h-[2px] w-3 bg-bronze" />
                  {item}
                </li>
              ))}
            </ul>
            {scope.map((group) => (
              <div key={group.heading} className="mt-10">
                <h3 className="text-[1.125rem]">{group.heading}</h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <li key={item.title} className="rounded-full bg-mist px-3.5 py-1.5 text-[0.875rem] text-body">
                      {item.title}
                      {item.draft ? <DraftBadge /> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <aside className="panel flex flex-col justify-between bg-dark p-6 text-white sm:p-10 lg:col-span-4">
            <div>
              <p className="text-[0.875rem] text-on-dark">Итоговый документ</p>
              <p className="mt-3 text-[1.625rem] leading-tight font-medium text-white">{service.result.title}</p>
              <span aria-hidden="true" className="mt-6 block h-[2px] w-10 bg-bronze" />
              <p className="mt-6 text-[0.9375rem] leading-relaxed text-on-dark">{service.result.text}</p>
            </div>
            <dl className="mt-10 space-y-4 border-t border-white/15 pt-6">
              {service.basis.map((item) => (
                <div key={item.code}>
                  <dt className="font-medium text-white">{item.code}</dt>
                  <dd className="mt-1 text-[0.8125rem] leading-relaxed text-on-dark">{item.text}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      {subPages.length > 0 ? (
        <section aria-labelledby="subpages-title" className="container-page mt-20 lg:mt-24">
          <SectionHead
            id="subpages-title"
            eyebrow="Подробнее"
            title={slug === "ocenka" ? "Оценка по видам объектов" : "Подробно о частых задачах"}
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subPages.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/uslugi/${page.slug}`}
                  className="group flex h-full flex-col justify-between gap-5 rounded-[var(--radius-card)] bg-white p-6 transition-colors hover:bg-white/80"
                >
                  <span>
                    <span className="block text-[1.125rem] font-medium text-ink group-hover:text-bronze-deep">{page.shortTitle}</span>
                    <span className="mt-2 block text-[0.9375rem] leading-relaxed text-muted">{page.summary}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4 self-end text-bronze-deep" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Порядок: здесь номера отражают последовательность этапов. */}
      <section id="poryadok" aria-labelledby="steps-title" className="container-page mt-20 scroll-mt-10 lg:mt-24">
        <SectionHead
          id="steps-title"
          eyebrow="Порядок"
          title="Как проходит работа"
          action={
            <Link href="/poryadok-raboty" className="text-link text-[0.9375rem]">
              Общие условия и оплата
            </Link>
          }
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {details.steps.map((step, index) => (
            <li key={step.title} className="surface relative p-6">
              <span className="text-[2.25rem] leading-none font-light text-steel tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-6 text-[1.0625rem]">{step.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{step.text}</p>
              {index < details.steps.length - 1 ? (
                <span aria-hidden="true" className="absolute top-9 right-6 hidden h-px w-10 bg-bronze lg:block" />
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* Что подготовить и вопросы: две колонки. */}
      <section className="container-page mt-20 lg:mt-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div aria-labelledby="prepare-title" role="region" className="lg:col-span-5">
            <SectionHead id="prepare-title" eyebrow="Документы" title={service.prepare.heading} lead={service.prepare.intro} />
            <ul className="mt-8 space-y-3">
              {prepare.map((item) => (
                <li key={item.title} className="surface flex gap-4 p-4 text-ink">
                  <span aria-hidden="true" className="mt-2.5 h-[2px] w-3 shrink-0 bg-bronze" />
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
          <div aria-labelledby="faq-title" role="region" className="lg:col-span-6 lg:col-start-7">
            <SectionHead id="faq-title" eyebrow="Вопросы" title="Частые вопросы" />
            <div className="mt-8 divide-y divide-line rounded-[var(--radius-card)] bg-white px-6">
              {details.faq.map((item) => (
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

      <CtaBand service={service.slug} />

      {articles.length > 0 ? (
        <section aria-labelledby="articles-title" className="container-page mt-20 lg:mt-24">
          <SectionHead
            id="articles-title"
            eyebrow="Статьи"
            title="Статьи по теме"
            action={
              <ButtonLink href="/stati" variant="outline">
                Все статьи
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </ButtonLink>
            }
          />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <ArticleCard article={a} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="other-title" className="container-page mt-20 lg:mt-24">
        <SectionHead
          id="other-title"
          eyebrow="Услуги"
          title="Другие направления"
          action={
            <ButtonLink href="/uslugi" variant="outline">
              Все услуги
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </ButtonLink>
          }
        />
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {others.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/uslugi/${item.slug}`}
                className="group flex h-full flex-col justify-between gap-6 rounded-[var(--radius-card)] border-t-[3px] border-bronze bg-white p-7"
              >
                <span>
                  <span className="block text-[1.375rem] leading-snug font-medium text-ink">{item.title}</span>
                  <span className="mt-3 block max-w-[34rem] text-[0.9375rem] leading-relaxed text-muted">{item.summary}</span>
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
