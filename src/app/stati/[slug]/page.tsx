import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { company } from "@/config/company";
import { getService } from "@/config/services";
import { articleCategories, formatDate, getArticle, getArticles, getRelatedArticles } from "@/lib/articles";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SectionHead } from "@/components/ui/SectionHead";
import { Breadcrumbs } from "@/components/layout/PageHeader";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  const base = pageMetadata({ title: article.title, description: article.description, path: `/stati/${slug}` });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: article.published,
      modifiedTime: article.updated ?? article.published,
    },
    robots: article.draft ? { index: false, follow: false } : undefined,
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const services = article.services.map(getService).filter((s) => s !== undefined);
  const related = getRelatedArticles(article).map((a) => ({ ...a, categoryLabel: articleCategories[a.category] }));
  const toc = article.headings.filter((h) => h.level === 2);
  const url = absoluteUrl(`/stati/${slug}`);

  // Структурированные данные статьи: только реальные сведения.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.published,
    dateModified: article.updated ?? article.published,
    inLanguage: "ru",
    ...(url ? { mainEntityOfPage: url, url } : {}),
    author: { "@type": "Organization", name: company.legalName },
    publisher: { "@type": "Organization", name: company.legalName },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="container-page pt-6 sm:pt-8">
        <header className="panel bg-white px-5 pt-7 pb-10 sm:px-10 sm:pt-9 sm:pb-12 lg:px-12">
          <Breadcrumbs crumbs={[{ label: "Статьи", href: "/stati" }, { label: articleCategories[article.category] }]} />
          <div className="mt-10 max-w-[52rem] lg:mt-12">
            <span className="inline-flex items-center gap-2 text-[0.875rem] font-medium text-muted">
              <span aria-hidden="true" className="h-[2px] w-6 bg-bronze" />
              {articleCategories[article.category]}
            </span>
            <h1 className="mt-5 text-[2rem] leading-[1.15] tracking-[-0.015em] sm:text-[2.5rem] lg:text-[2.875rem]">
              {article.title}
            </h1>
            <p className="lead mt-6">{article.description}</p>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-muted">
              <CalendarDays aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              <span>
                Опубликовано <time dateTime={article.published}>{formatDate(article.published)}</time>
              </span>
              {article.updated ? (
                <span>
                  · Обновлено <time dateTime={article.updated}>{formatDate(article.updated)}</time>
                </span>
              ) : null}
              <span>· {article.readingMinutes} мин чтения</span>
              {article.draft ? <span className="rounded bg-bronze-soft px-1.5 text-bronze-deep">черновик</span> : null}
            </p>
          </div>
        </header>
      </div>

      <div className="container-page mt-4 grid gap-4 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          {toc.length > 2 ? (
            <>
              <details className="group rounded-[var(--radius-card)] bg-white px-5 lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                  Содержание
                  <span aria-hidden="true" className="text-bronze-deep group-open:hidden">
                    +
                  </span>
                  <span aria-hidden="true" className="hidden text-bronze-deep group-open:inline">
                    −
                  </span>
                </summary>
                <ol className="space-y-2.5 pb-5 text-[0.9375rem]">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="text-body hover:text-ink hover:underline">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
              <nav aria-label="Содержание статьи" className="hidden rounded-[var(--radius-card)] bg-white p-6 lg:sticky lg:top-6 lg:block">
                <p className="text-[0.875rem] font-medium text-muted">Содержание</p>
                <ol className="mt-5 space-y-2.5 border-t border-line pt-5 text-[0.875rem] leading-snug">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="text-body hover:text-ink hover:underline hover:underline-offset-4">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </>
          ) : null}
        </aside>

        <article className="panel min-w-0 bg-white px-5 py-8 sm:px-10 sm:py-12 lg:col-span-6">
          <div className="article-body" dangerouslySetInnerHTML={{ __html: article.html }} />
          <p className="mt-12 max-w-[68ch] border-t border-line pt-5 text-[0.875rem] leading-relaxed text-muted">
            Материал носит информационный характер и не является юридической консультацией. Порядок действий в
            конкретной ситуации зависит от её обстоятельств.
          </p>
          <Link href="/stati" className="text-link mt-8 inline-flex items-center gap-2 text-[0.9375rem]">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Все статьи
          </Link>
        </article>

        <aside className="space-y-4 lg:col-span-3 lg:sticky lg:top-6 lg:self-start">
          {services.length > 0 ? (
            <div className="rounded-[var(--radius-card)] bg-white p-6">
              <p className="text-[0.875rem] font-medium text-muted">Услуги по теме</p>
              <ul className="mt-4 border-t border-line text-[0.9375rem]">
                {services.map((service) => (
                  <li key={service.slug} className="border-b border-line">
                    <Link href={`/uslugi/${service.slug}`} className="group flex items-center justify-between gap-2 py-3 text-ink">
                      <span className="group-hover:underline group-hover:underline-offset-4">{service.title}</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-[var(--radius-card)] bg-dark p-6 text-white">
            <p className="font-medium text-white">Нужна консультация по вашей ситуации?</p>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-on-dark">Опишите задачу — ответим после предварительного анализа.</p>
            <ButtonLink href="/kontakty#zayavka" variant="bronze" className="mt-5 w-full min-h-11 px-4 text-[0.875rem]">
              Оставить заявку
            </ButtonLink>
          </div>
        </aside>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="container-page mt-20 lg:mt-24">
          <div>
            <SectionHead
              id="related-title"
              eyebrow="Статьи"
              title="Читайте также"
              action={
                <ButtonLink href="/stati" variant="outline">
                  Все статьи
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </ButtonLink>
              }
            />
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {related.map((a) => (
                <li key={a.slug}>
                  <ArticleCard article={a} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
