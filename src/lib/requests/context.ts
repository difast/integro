import { objectCodes, objectLabels, type ObjectType } from "@/lib/document-helper";
import { getServicePage } from "@/config/service-pages";

/**
 * Контекст обращения по адресу страницы с формой: с какой страницы услуги пришёл
 * посетитель и какую рекомендацию дал помощник. Принимаются только известные значения;
 * текст заявки не подменяется.
 */
const recommendationLabels: Record<string, string> = {
  otchet: "отчёт об оценке",
  zaklyuchenie: "заключение специалиста",
  ekspertiza: "судебная экспертиза",
  konsultaciya: "нужна консультация",
};

export function describeRequestContext(sourcePage: string | null): string | null {
  if (!sourcePage) return null;
  const query = sourcePage.split("?")[1]?.split("#")[0];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const parts: string[] = [];

  const recommendation = params.get("rekomendaciya");
  if (recommendation && recommendationLabels[recommendation]) {
    const object = params.get("obekt");
    const objectLabel = object && objectCodes.includes(object as ObjectType) ? objectLabels[object as ObjectType] : null;
    parts.push(
      `Помощник «Какой документ мне нужен?»: ${recommendationLabels[recommendation]}${objectLabel ? ` (${objectLabel.toLowerCase()})` : ""}`,
    );
  }

  const page = getServicePage(params.get("usluga") ?? "");
  if (page) parts.push(`Страница услуги: ${page.shortTitle}`);

  return parts.length > 0 ? parts.join("; ").slice(0, 300) : null;
}
