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
      className={`group flex h-full min-h-[300px] flex-col border-t-[3px] p-6 transition-colors sm:p-7 ${
        dark
          ? "border-accent bg-navy-900 text-white hover:bg-navy-800"
          : "border-navy-900 bg-paper hover:bg-navy-100/60"
      }`}
    >
      <span
        className={`self-start border px-2.5 py-1 text-[0.75rem] font-medium tracking-[0.06em] uppercase ${
          dark ? "border-white/30 text-navy-300" : "border-line-strong text-muted"
        }`}
      >
        {article.categoryLabel}
      </span>
      <h3
        className={`mt-6 text-[1.25rem] leading-snug group-hover:underline group-hover:decoration-accent group-hover:underline-offset-[5px] ${
          dark ? "text-white" : ""
        }`}
      >
        {article.title}
      </h3>
      <div className="mt-3 flex-1">
        <p className={`line-clamp-3 text-[0.9375rem] leading-relaxed ${dark ? "text-navy-300" : "text-muted"}`}>
          {article.description}
        </p>
      </div>
      <p className={`mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] whitespace-nowrap ${dark ? "text-navy-300" : "text-muted"}`}>
        <CalendarDays aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        <time dateTime={article.published}>{formatDate(article.published)}</time>
        <span aria-hidden="true">·</span>
        <span>{article.readingMinutes} мин чтения</span>
      </p>
    </Link>
  );
}
