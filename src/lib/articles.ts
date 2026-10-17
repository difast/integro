import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { marked } from "marked";

/**
 * Статьи хранятся в content/articles/*.md.
 *
 * Формат файла: блок метаданных между строками `---`, затем текст в Markdown.
 *   title:        Заголовок (H1)
 *   description:  Краткий анонс для карточки и meta description
 *   category:     Категория (см. articleCategories)
 *   published:    Дата публикации, ГГГГ-ММ-ДД
 *   updated:      Дата обновления, ГГГГ-ММ-ДД (необязательно)
 *   services:     [slug-услуги, …] — связанные услуги (необязательно)
 *   draft:        true — черновик, не публикуется в production
 *
 * Имя файла без .md — адрес статьи: /stati/<имя-файла>.
 */

export const articleCategories = {
  ocenka: "Оценка",
  ekspertiza: "Судебная экспертиза",
  rabota: "Работа с заказчиком",
} as const;

export type ArticleCategory = keyof typeof articleCategories;

export type ArticleHeading = { id: string; text: string; level: 2 | 3 };

export type ArticleMeta = {
  slug: string;
  title: string;
  description: string;
  category: ArticleCategory;
  published: string;
  updated?: string;
  services: string[];
  draft: boolean;
  readingMinutes: number;
};

export type Article = ArticleMeta & {
  html: string;
  headings: ArticleHeading[];
};

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

const showDrafts = process.env.NODE_ENV !== "production" || process.env.SHOW_DRAFT_CONTENT === "true";

const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => translit[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseFrontmatter(source: string, file: string): { data: Record<string, string | string[]>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`Article ${file}: missing frontmatter`);
  const data: Record<string, string | string[]> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const [, key, raw] = kv as unknown as [string, string, string];
    const value = raw.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      data[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return { data, body: match[2]! };
}

function str(value: string | string[] | undefined, key: string, file: string): string {
  if (typeof value !== "string" || !value) throw new Error(`Article ${file}: "${key}" is required`);
  return value;
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function readArticle(file: string): Article {
  const slug = file.replace(/\.md$/, "");
  const { data, body } = parseFrontmatter(readFileSync(path.join(ARTICLES_DIR, file), "utf8"), file);

  const category = str(data.category, "category", file);
  if (!(category in articleCategories)) throw new Error(`Article ${file}: unknown category "${category}"`);
  const published = str(data.published, "published", file);
  if (!isDate(published)) throw new Error(`Article ${file}: invalid "published" date`);
  const updated = typeof data.updated === "string" && data.updated ? data.updated : undefined;
  if (updated && !isDate(updated)) throw new Error(`Article ${file}: invalid "updated" date`);

  // Markdown → HTML; заголовкам h2/h3 добавляются якоря для оглавления.
  const headings: ArticleHeading[] = [];
  const used = new Set<string>();
  const rawHtml = marked.parse(body, { async: false, gfm: true }) as string;
  const html = rawHtml.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
    let id = slugify(text) || `section-${headings.length + 1}`;
    while (used.has(id)) id = `${id}-2`;
    used.add(id);
    headings.push({ id, text, level: Number(level) as 2 | 3 });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

  const words = body.split(/\s+/).filter(Boolean).length;

  return {
    slug,
    title: str(data.title, "title", file),
    description: str(data.description, "description", file),
    category: category as ArticleCategory,
    published,
    updated,
    services: Array.isArray(data.services) ? data.services : [],
    draft: data.draft === "true",
    readingMinutes: Math.max(1, Math.round(words / 180)),
    html,
    headings,
  };
}

let cache: Article[] | null = null;

function allArticles(): Article[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
  cache = files
    .map(readArticle)
    .filter((a) => showDrafts || !a.draft)
    .sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : a.title.localeCompare(b.title, "ru")));
  return cache;
}

/** Опубликованные статьи, новые сверху (без текста). */
export function getArticles(): ArticleMeta[] {
  return allArticles().map((a) => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    category: a.category,
    published: a.published,
    updated: a.updated,
    services: a.services,
    draft: a.draft,
    readingMinutes: a.readingMinutes,
  }));
}

export function getArticle(slug: string): Article | undefined {
  return allArticles().find((a) => a.slug === slug);
}

export function getArticlesForService(serviceSlug: string, limit = 3): ArticleMeta[] {
  return getArticles()
    .filter((a) => a.services.includes(serviceSlug))
    .slice(0, limit);
}

export function getRelatedArticles(article: ArticleMeta, limit = 3): ArticleMeta[] {
  const others = getArticles().filter((a) => a.slug !== article.slug);
  const score = (a: ArticleMeta) =>
    (a.category === article.category ? 2 : 0) + a.services.filter((s) => article.services.includes(s)).length;
  return [...others].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export { formatDate } from "./format";
