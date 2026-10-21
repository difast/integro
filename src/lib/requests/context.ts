import { objectCodes, objectLabels, type ObjectType } from "@/lib/document-helper";
import { getServicePage } from "@/config/service-pages";
import { getService } from "@/config/services";
import { russiaRegionNames } from "@/data/russia-region-names";

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

function serviceTitle(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return getServicePage(slug)?.shortTitle ?? getService(slug)?.title ?? null;
}

export function describeRequestContext(sourcePage: string | null): string | null {
  if (!sourcePage) return null;
  const [path = "", rest = ""] = sourcePage.split("?");
  const params = new URLSearchParams(rest.split("#")[0]);
  const parts: string[] = [];

  if (params.get("forma") === "okno") parts.push("Всплывающая форма");

  const recommendation = params.get("rekomendaciya");
  if (recommendation && recommendationLabels[recommendation]) {
    const object = params.get("obekt");
    const objectLabel = object && objectCodes.includes(object as ObjectType) ? objectLabels[object as ObjectType] : null;
    parts.push(
      `Помощник «Какой документ мне нужен?»: ${recommendationLabels[recommendation]}${objectLabel ? ` (${objectLabel.toLowerCase()})` : ""}`,
    );
  }

  // Страница услуги: из параметра usluga (переход на «Контакты») или из адреса страницы, где открыто окно.
  const pathSlug = /^\/uslugi\/([a-z0-9-]+)$/.exec(path)?.[1];
  const fromParam = getServicePage(params.get("usluga") ?? "")?.shortTitle ?? null;
  const fromPath = serviceTitle(pathSlug);
  const title = fromParam ?? fromPath;
  if (title) parts.push(`Страница услуги: ${title}`);

  // Регион, выбранный на карте на главной (только известные коды субъектов).
  const region = params.get("region");
  if (region && Object.hasOwn(russiaRegionNames, region)) parts.push(`Регион на карте: ${russiaRegionNames[region]}`);

  return parts.length > 0 ? parts.join("; ").slice(0, 300) : null;
}
