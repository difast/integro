import { pageMetadata } from "@/lib/metadata";
import { articleCategories, getArticles } from "@/lib/articles";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArticlesBrowser } from "@/components/sections/ArticlesBrowser";
import { CtaBand } from "@/components/sections/CtaBand";

export const metadata = pageMetadata({
  title: "Статьи",
  description:
    "Статьи ООО «Интегро» об оценке имущества и судебной экспертизе: чем отличаются документы, как назначается экспертиза, какие документы нужны и как проходит работа.",
  path: "/stati",
});

export default function ArticlesPage() {
  const articles = getArticles().map((a) => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    category: a.category,
    categoryLabel: articleCategories[a.category],
    published: a.published,
    readingMinutes: a.readingMinutes,
  }));

  return (
    <>
      <PageHeader
        title="Статьи"
        crumbs={[{ label: "Статьи" }]}
        lead="Разбираем вопросы, с которыми к нам обращаются: оценка имущества, судебная экспертиза, документы и порядок работы."
      />
      <section aria-label="Список статей" className="container-page mt-10 lg:mt-14">
        <ArticlesBrowser
          articles={articles}
          categories={Object.entries(articleCategories).map(([key, label]) => ({ key, label }))}
        />
      </section>
      <CtaBand />
    </>
  );
}
