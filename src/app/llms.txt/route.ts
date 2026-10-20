import { company } from "@/config/company";
import { legalDocumentList } from "@/config/legal";
import { servicePages } from "@/config/service-pages";
import { services } from "@/config/services";
import { getArticles } from "@/lib/articles";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * /llms.txt — краткое описание сайта и ссылки на основные страницы для языковых моделей и ИИ-поиска
 * (формат llmstxt.org). Собирается из тех же конфигов, что и страницы, поэтому не расходится с сайтом.
 */
export function GET() {
  const base = getSiteUrl() ?? "";
  const link = (title: string, path: string, note?: string) => `- [${title}](${base}${path === "/" ? "/" : path})${note ? `: ${note}` : ""}`;
  const { contacts, requisites } = company;

  const lines = [
    `# ${company.legalName}`,
    "",
    "> Оценка имущества и бизнеса, судебная экспертиза и экспертные исследования. Москва.",
    "",
    [
      `${company.fullLegalName}, ИНН ${requisites.inn}, ОГРН ${requisites.ogrn}, юридический адрес: ${requisites.legalAddress}.`,
      contacts.phone ? `Телефон: ${contacts.phone}.` : "",
      contacts.email ? `Электронная почта: ${contacts.email}.` : "",
      contacts.workingHours ? `Часы связи: ${contacts.workingHours.toLowerCase()}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    "",
    "## Услуги",
    "",
    ...services.map((s) => link(s.title, `/uslugi/${s.slug}`, s.summary)),
    ...servicePages.map((p) => link(p.title, `/uslugi/${p.slug}`, p.metaDescription)),
    "",
    "## Помощь в выборе",
    "",
    link("Какой документ мне нужен", "/kakoy-dokument-nuzhen", "помощник: отчёт об оценке, заключение эксперта или экспертное исследование"),
    link("Для юристов", "/dlya-yuristov", "вопросы эксперту и шаблон ходатайства о назначении экспертизы"),
    link("Порядок работы", "/poryadok-raboty"),
    "",
  ];

  const articles = getArticles().filter((a) => !a.draft);
  if (articles.length) lines.push("## Статьи", "", ...articles.map((a) => link(a.title, `/stati/${a.slug}`, a.description)), "");

  lines.push(
    "## О компании",
    "",
    link("О компании", "/o-kompanii"),
    link("Контакты и заявка", "/kontakty"),
    ...legalDocumentList.map((d) => link(d.title, d.href, d.description)),
    "",
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
