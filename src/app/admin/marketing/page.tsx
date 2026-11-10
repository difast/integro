import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { shortLinkPath } from "@/lib/marketing/links";
import { clicksByDay, listLinkStats, type LinkStats } from "@/lib/marketing/repository";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { absoluteUrl } from "@/lib/site";
import { parseStatsPeriod, statsPeriods, type StatsPeriod } from "@/lib/stats/clicks";
import { CopyLinkButton, CreateLinkForm, ToggleLinkForm } from "@/components/admin/MarketingLinkControls";

export const metadata: Metadata = { title: "Маркетинг" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const thClass = "px-4 py-3 font-medium";
const tdNum = "px-4 py-3 text-right tabular-nums";

async function load(period: StatsPeriod) {
  try {
    const [links, days] = await Promise.all([listLinkStats(period.days), clicksByDay(period.days)]);
    return { links, days, failed: false as const };
  } catch (error) {
    console.error("[admin] failed to load marketing stats:", describeDbError(error));
    return { failed: true as const };
  }
}

const formatDay = (day: string) => day.split("-").reverse().join(".");
const percent = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1).replace(".", ",")} %` : "—");
const rub = (value: number) => (value > 0 ? `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽` : "—");

function linkUrl(link: LinkStats): string {
  return absoluteUrl(shortLinkPath(link.slug)) ?? shortLinkPath(link.slug);
}

export default async function AdminMarketingPage({ searchParams }: Props) {
  await requireAdminPage();
  const period = parseStatsPeriod((await searchParams).period);
  const data = await load(period);

  if (data.failed) {
    return (
      <div className="container-page mt-10">
        <div role="alert" className="rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6">
          <h1 className="text-[1.25rem]">База данных недоступна</h1>
          <p className="mt-2 text-muted">Не удалось получить статистику. Обновите страницу чуть позже.</p>
        </div>
      </div>
    );
  }

  const { links } = data;
  const totals = links.reduce(
    (sum, l) => ({ clicks: sum.clicks + l.clicks, requests: sum.requests + l.requests, won: sum.won + l.won }),
    { clicks: 0, requests: 0, won: 0 },
  );
  const dayColumns = links.filter((l) => l.active || data.days.some((d) => d.linkId === l.id));
  const dayRows = [...new Set(data.days.map((d) => d.day))].map((day) => ({
    day,
    counts: dayColumns.map((l) => data.days.find((d) => d.day === day && d.linkId === l.id)?.count ?? 0),
  }));

  return (
    <div className="container-page mt-8 lg:mt-10">
      <h1 className="text-[2rem] leading-tight">Маркетинг</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Короткие ссылки для соцсетей и рекламы. Переход по ссылке засчитывается и ведёт на сайт с UTM-метками, поэтому
        заявки, отправленные после перехода, привязываются к ссылке. Хранятся только ссылка и время перехода — без данных
        о посетителе; роботы и превью ссылок в соцсетях не считаются.
      </p>

      <nav aria-label="Период" className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {statsPeriods.map((item) => (
            <li key={item.value}>
              <Link
                href={item.value === "30" ? "/admin/marketing" : `/admin/marketing?period=${item.value}`}
                aria-current={item.value === period.value ? "page" : undefined}
                className="inline-flex min-h-10 items-center rounded-full border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink aria-[current=page]:border-dark aria-[current=page]:bg-dark aria-[current=page]:text-white"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <dl className="mt-6 grid grid-cols-3 gap-3 sm:flex sm:flex-wrap">
        <div className="rounded-[var(--radius-card)] bg-dark px-5 py-3 text-white sm:min-w-40">
          <dt className="text-[0.8125rem] text-on-dark">Переходы</dt>
          <dd className="text-[1.5rem] leading-tight font-medium" data-testid="marketing-clicks-total">
            {totals.clicks}
          </dd>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white px-5 py-3 sm:min-w-40">
          <dt className="text-[0.8125rem] text-muted">Заявки</dt>
          <dd className="text-[1.5rem] leading-tight font-medium text-ink">{totals.requests}</dd>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white px-5 py-3 sm:min-w-40">
          <dt className="text-[0.8125rem] text-muted">Сделки</dt>
          <dd className="text-[1.5rem] leading-tight font-medium text-ink">{totals.won}</dd>
        </div>
      </dl>

      <section aria-labelledby="links-title" className="mt-8">
        <h2 id="links-title" className="text-[1.25rem]">
          Ссылки
        </h2>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] bg-white">
          <table className="w-full min-w-[860px] border-collapse text-left text-[0.9375rem]">
            <thead>
              <tr className="border-b border-line text-[0.8125rem] text-muted">
                <th scope="col" className={thClass}>Ссылка</th>
                <th scope="col" className={thClass}>Чья</th>
                <th scope="col" className={`${thClass} text-right`}>Переходы</th>
                <th scope="col" className={`${thClass} text-right`}>Заявки</th>
                <th scope="col" className={`${thClass} text-right`}>Конверсия</th>
                <th scope="col" className={`${thClass} text-right`}>Сделки</th>
                <th scope="col" className={`${thClass} text-right`}>Оплачено</th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {links.map((link) => (
                <tr key={link.id} data-testid={`marketing-row-${link.slug}`} className={link.active ? "" : "text-muted"}>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-ink">
                      {link.title}
                      {link.active ? null : <span className="ml-2 text-[0.8125rem] font-normal text-muted">(отключена)</span>}
                    </p>
                    <p className="mt-1 text-[0.8125rem] break-all text-muted">{linkUrl(link)}</p>
                    <p className="mt-0.5 text-[0.75rem] text-muted">
                      Ведёт на {link.targetPath} · {link.utmSource}
                      {link.utmCampaign ? ` / ${link.utmCampaign}` : ""}
                      {link.lastClickAt ? ` · последний переход ${formatMoscowDateTime(link.lastClickAt)}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">{link.ownerLabel || "—"}</td>
                  <td className={`${tdNum} align-top`} data-testid={`marketing-clicks-${link.slug}`}>
                    {link.clicks}
                  </td>
                  <td className={`${tdNum} align-top`} data-testid={`marketing-requests-${link.slug}`}>
                    {link.requests}
                  </td>
                  <td className={`${tdNum} align-top`}>{percent(link.requests, link.clicks)}</td>
                  <td className={`${tdNum} align-top`}>{link.won}</td>
                  <td className={`${tdNum} align-top`}>{rub(link.paid)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      <CopyLinkButton url={linkUrl(link)} label={link.title} />
                      <ToggleLinkForm id={link.id} active={link.active} title={link.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[0.8125rem] text-muted">
          Заявки — с сайта, отправленные после перехода по ссылке в той же вкладке браузера. Конверсия — заявки от
          переходов. Сделки и оплаты — по этим заявкам, по данным карточек.
        </p>
      </section>

      {dayRows.length > 0 ? (
        <section aria-labelledby="days-title" className="mt-8">
          <h2 id="days-title" className="text-[1.25rem]">
            Переходы по дням
          </h2>
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] bg-white">
            <table className="w-full min-w-[480px] border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-b border-line text-[0.8125rem] text-muted">
                  <th scope="col" className={thClass}>День</th>
                  {dayColumns.map((l) => (
                    <th key={l.id} scope="col" className={`${thClass} text-right`}>
                      {l.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dayRows.map((row) => (
                  <tr key={row.day}>
                    <td className="px-4 py-3">{formatDay(row.day)}</td>
                    {row.counts.map((count, i) => (
                      <td key={dayColumns[i]!.id} className={tdNum}>
                        {count || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="new-link-title" className="mt-8 rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
        <h2 id="new-link-title" className="text-[1.25rem]">
          Новая ссылка
        </h2>
        <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted">
          Для каждой площадки и каждого человека — своя ссылка, тогда статистика будет раздельной.
        </p>
        <div className="mt-5">
          <CreateLinkForm />
        </div>
      </section>
    </div>
  );
}
