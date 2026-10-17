"use client";

import { useState } from "react";
import { ArticleCard, type ArticleCardData } from "@/components/ui/ArticleCard";
import { FilterTabs } from "@/components/ui/FilterTabs";

type BrowserArticle = ArticleCardData & { category: string };

/** Список статей с фильтром по категориям (без перезагрузки страницы). */
export function ArticlesBrowser({
  articles,
  categories,
}: {
  articles: BrowserArticle[];
  categories: { key: string; label: string }[];
}) {
  const [active, setActive] = useState("all");
  const visible = active === "all" ? articles : articles.filter((a) => a.category === active);
  const tabs = [
    { key: "all", label: "Все статьи", count: articles.length },
    ...categories
      .map((c) => ({ ...c, count: articles.filter((a) => a.category === c.key).length }))
      .filter((c) => c.count > 0),
  ];

  return (
    <div>
      <FilterTabs tabs={tabs} active={active} onChange={setActive} label="Категории статей" />
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {visible.map((article, index) => (
          <li key={article.slug}>
            <ArticleCard article={article} tone={active === "all" && index === 0 ? "dark" : "light"} />
          </li>
        ))}
      </ul>
    </div>
  );
}
