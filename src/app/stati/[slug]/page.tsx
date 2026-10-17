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

      <header className="border-b border-line bg-paper">
        <div className="container-page pt-8 pb-12 sm:pt-10 lg:pb-16">
          <nav aria-label="Навигационная цепочка">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem] text-muted">
              <li>
                <Link href="/" className="hover:text-ink">
                  Главная
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
                <Link href="/stati" className="hover:text-ink">
                  Статьи
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
                <span aria-current="page" className="text-ink">
                  {articleCategories[article.category]}
                </span>
              </li>
            </ol>
          </nav>
          <div className="mt-10 max-w-[52rem] lg:mt-14">
            <span className="inline-block border border-line-strong px-2.5 py-1 text-[0.75rem] font-medium tracking-[0.06em] text-muted uppercase">
              {articleCategories[article.category]}
            </span>
            <h1 className="mt-6 text-[2rem] leading-[1.15] tracking-[-0.015em] sm:text-[2.5rem] lg:text-[2.875rem]">
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
              {article.draft ? <span className="bg-amber-100 px-1.5 text-amber-900">черновик</span> : null}
            </p>
          </div>
        </div>
      </header>

      <div className="container-page grid gap-12 py-12 lg:grid-cols-12 lg:gap-8 lg:py-16">
        <aside className="lg:col-span-3">
          {toc.length > 2 ? (
            <>
              <details className="group border-y border-line lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                  Содержание
                  <span aria-hidden="true" className="text-accent group-open:hidden">
                    +
                  </span>
                  <span aria-hidden="true" className="hidden text-accent group-open:inline">
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
              <nav aria-label="Содержание статьи" className="hidden lg:sticky lg:top-28 lg:block">
                <p className="label">Содержание</p>
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

        <article className="min-w-0 lg:col-span-6">
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

        <aside className="space-y-8 lg:col-span-3 lg:sticky lg:top-28 lg:self-start">
          {services.length > 0 ? (
            <div>
              <p className="label">Услуги по теме</p>
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
          <div className="border-t-[3px] border-navy-900 bg-paper p-5">
            <p className="font-semibold text-ink">Нужна консультация по вашей ситуации?</p>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">Опишите задачу — ответим после предварительного анализа.</p>
            <ButtonLink href="/kontakty#zayavka" className="mt-4 w-full min-h-11 px-4 text-[0.875rem]">
              Оставить заявку
            </ButtonLink>
          </div>
        </aside>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="bg-paper">
          <div className="container-page py-16 lg:py-20">
            <div className="flex flex-col gap-6 border-t border-ink pt-6 sm:flex-row sm:items-end sm:justify-between">
              <h2 id="related-title" className="h-section">
                Читайте также
              </h2>
              <ButtonLink href="/stati" variant="outline">
                Все статьи
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </ButtonLink>
            </div>
            <ul className="mt-10 grid gap-6 md:grid-cols-3">
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
