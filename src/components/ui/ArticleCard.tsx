import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/format";

export type ArticleCardData = {
  slug: string;
  title: string;
  description: string;
  categoryLabel: string;
  published: string;
  readingMinutes: number;
};

/** Карточка статьи: категория, дата, заголовок и анонс. Тёмный вариант — для выделенной статьи. */
export function ArticleCard({ article, tone = "light" }: { article: ArticleCardData; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <Link
      href={`/stati/${article.slug}`}
      className={`group flex h-full min-h-[320px] flex-col rounded-[var(--radius-card)] p-6 transition-colors sm:p-7 ${
        dark ? "bg-dark text-white hover:bg-dark-800" : "bg-white hover:bg-white/70"
      }`}
    >
      <span
        className={`inline-flex items-center gap-2 self-start text-[0.8125rem] font-medium ${dark ? "text-on-dark" : "text-muted"}`}
      >
        <span aria-hidden="true" className="h-[2px] w-5 bg-bronze" />
        {article.categoryLabel}
      </span>
      <h3
        className={`mt-6 text-[1.25rem] leading-snug group-hover:underline group-hover:decoration-bronze group-hover:underline-offset-[5px] ${
          dark ? "text-white" : ""
        }`}
      >
        {article.title}
      </h3>
      <div className="mt-3 flex-1">
        <p className={`line-clamp-3 text-[0.9375rem] leading-relaxed ${dark ? "text-on-dark" : "text-muted"}`}>
          {article.description}
        </p>
      </div>
      <p
        className={`mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-4 text-[0.8125rem] whitespace-nowrap ${
          dark ? "border-white/15 text-on-dark" : "border-line text-muted"
        }`}
      >
        <CalendarDays aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        <time dateTime={article.published}>{formatDate(article.published)}</time>
        <span aria-hidden="true">·</span>
        <span>{article.readingMinutes} мин чтения</span>
      </p>
    </Link>
  );
}
