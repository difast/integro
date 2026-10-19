import type { Metadata } from "next";
import Link from "next/link";
import { company } from "@/config/company";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import {
  clickPlacements,
  messengerKeys,
  messengerLabels,
  parseStatsPeriod,
  placementLabels,
  statsPeriods,
  type MessengerKey,
  type StatsPeriod,
} from "@/lib/stats/clicks";
import { getClickStats } from "@/lib/stats/repository";

export const metadata: Metadata = { title: "Статистика" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const brandColors: Record<MessengerKey, string> = {
  whatsapp: "#25D366",
  telegram: "#26A5E4",
  max: "#7B5CFA",
};

const thClass = "px-5 py-3 font-medium";
const tdNumClass = "px-5 py-3 text-right tabular-nums";

async function loadStats(period: StatsPeriod) {
  try {
    return { stats: await getClickStats(period.days), failed: false as const };
  } catch (error) {
    console.error("[admin] failed to load click stats:", describeDbError(error));
    return { failed: true as const };
  }
}

function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}.${month}.${year}`;
}

export default async function AdminStatsPage({ searchParams }: Props) {
  await requireAdminPage();
  const period = parseStatsPeriod((await searchParams).period);
  const data = await loadStats(period);

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

  const { stats } = data;
  // Колонки — мессенджеры, которые сейчас есть на сайте, и те, по которым уже были переходы.
  const columns = messengerKeys.filter(
    (key) => company.contacts.messengers[key].href || (stats.byMessenger[key] ?? 0) > 0,
  );

  const placementRows = clickPlacements
    .map((placement) => {
      const counts = Object.fromEntries(
        columns.map((key) => [
          key,
          stats.byPlacement.find((row) => row.placement === placement && row.messenger === key)?.count ?? 0,
        ]),
      ) as Record<MessengerKey, number>;
      return { placement, counts, total: columns.reduce((sum, key) => sum + counts[key], 0) };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const days = [...new Set(stats.byDay.map((row) => row.day))].map((day) => {
    const counts = Object.fromEntries(
      columns.map((key) => [key, stats.byDay.find((row) => row.day === day && row.messenger === key)?.count ?? 0]),
    ) as Record<MessengerKey, number>;
    return { day, counts, total: columns.reduce((sum, key) => sum + counts[key], 0) };
  });

  const maxPage = stats.topPages[0]?.count ?? 0;

  return (
    <div className="container-page mt-8 lg:mt-10">
      <h1 className="text-[2rem] leading-tight">Переходы в мессенджеры</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Сколько раз посетители нажали на кнопки мессенджеров на сайте. Учитываются только мессенджер, место кнопки,
        страница и время — без данных о посетителе. Нажатие не означает, что человек написал сообщение.
      </p>

      <nav aria-label="Период" className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {statsPeriods.map((item) => (
            <li key={item.value}>
              <Link
                href={item.value === "30" ? "/admin/statistika" : `/admin/statistika?period=${item.value}`}
                aria-current={item.value === period.value ? "page" : undefined}
                className="inline-flex min-h-10 items-center rounded-full border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink aria-[current=page]:border-dark aria-[current=page]:bg-dark aria-[current=page]:text-white"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <div className="rounded-[var(--radius-card)] bg-dark px-5 py-3 text-white sm:min-w-40">
          <dt className="text-[0.8125rem] text-on-dark">Всего переходов</dt>
          <dd className="text-[1.5rem] leading-tight font-medium" data-testid="clicks-total">
            {stats.total}
          </dd>
        </div>
        {columns.map((key) => (
          <div key={key} className="rounded-[var(--radius-card)] bg-white px-5 py-3 sm:min-w-40">
            <dt className="flex items-center gap-2 text-[0.8125rem] text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColors[key] }} />
              {messengerLabels[key]}
            </dt>
            <dd className="text-[1.5rem] leading-tight font-medium text-ink" data-testid={`clicks-${key}`}>
              {stats.byMessenger[key] ?? 0}
            </dd>
          </div>
        ))}
      </dl>

      {stats.total === 0 ? (
        <p className="mt-6 rounded-[var(--radius-card)] bg-white px-6 py-12 text-center text-muted">
          За выбранный период переходов не было.
        </p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="by-placement" className="min-w-0">
            <h2 id="by-placement" className="text-[1.25rem]">
              Где нажимали
            </h2>
            <div className="relative mt-3 overflow-x-auto rounded-[var(--radius-card)] bg-white">
              <table className="w-full min-w-[420px] border-collapse text-left text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-line text-[0.8125rem] text-muted">
                    <th scope="col" className={thClass}>Место на сайте</th>
                    {columns.map((key) => (
                      <th key={key} scope="col" className={`${thClass} text-right`}>
                        {messengerLabels[key]}
                      </th>
                    ))}
                    <th scope="col" className={`${thClass} text-right`}>Всего</th>
                  </tr>
                </thead>
                <tbody>
                  {placementRows.map((row) => (
                    <tr key={row.placement} className="border-b border-line last:border-0">
                      <th scope="row" className="px-5 py-3 font-normal text-ink">
                        {placementLabels[row.placement]}
                      </th>
                      {columns.map((key) => (
                        <td key={key} className={tdNumClass}>
                          {row.counts[key]}
                        </td>
                      ))}
                      <td className={`${tdNumClass} font-medium text-ink`}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="by-page" className="min-w-0">
            <h2 id="by-page" className="text-[1.25rem]">
              С каких страниц
            </h2>
            <ol className="mt-3 overflow-hidden rounded-[var(--radius-card)] bg-white">
              {stats.topPages.map((row) => (
                <li key={row.path} className="border-b border-line px-5 py-3 last:border-0">
                  <span className="flex items-center justify-between gap-4 text-[0.9375rem]">
                    <a href={row.path} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-ink hover:text-bronze-deep">
                      {row.path}
                    </a>
                    <span className="shrink-0 font-medium tabular-nums text-ink">{row.count}</span>
                  </span>
                  <span aria-hidden="true" className="mt-2 block h-1 overflow-hidden rounded-full bg-mist">
                    <span
                      className="block h-full rounded-full bg-bronze"
                      style={{ width: `${maxPage ? Math.max(2, (row.count / maxPage) * 100) : 0}%` }}
                    />
                  </span>
                </li>
              ))}
            </ol>
            {stats.topPages.length >= 15 ? (
              <p className="mt-2 text-[0.8125rem] text-muted">Показаны 15 страниц с наибольшим числом переходов.</p>
            ) : null}
          </section>

          <section aria-labelledby="by-day" className="min-w-0 lg:col-span-2">
            <h2 id="by-day" className="text-[1.25rem]">
              По дням
            </h2>
            <div className="relative mt-3 max-h-[480px] overflow-auto rounded-[var(--radius-card)] bg-white">
              <table className="w-full min-w-[420px] border-collapse text-left text-[0.9375rem]">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-line text-[0.8125rem] text-muted">
                    <th scope="col" className={thClass}>Дата (МСК)</th>
                    {columns.map((key) => (
                      <th key={key} scope="col" className={`${thClass} text-right`}>
                        {messengerLabels[key]}
                      </th>
                    ))}
                    <th scope="col" className={`${thClass} text-right`}>Всего</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((row) => (
                    <tr key={row.day} className="border-b border-line last:border-0">
                      <th scope="row" className="px-5 py-3 font-normal whitespace-nowrap text-ink">
                        {formatDay(row.day)}
                      </th>
                      {columns.map((key) => (
                        <td key={key} className={tdNumClass}>
                          {row.counts[key]}
                        </td>
                      ))}
                      <td className={`${tdNumClass} font-medium text-ink`}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {period.days === null ? (
              <p className="mt-2 text-[0.8125rem] text-muted">По дням показаны последние 90 дней.</p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
