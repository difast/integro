import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { JOURNAL_PAGE, listJournal, type JournalFilters, type JournalRow } from "@/lib/ops/dashboard";
import { monitorChannelLabels, monitorOperationLabels } from "@/lib/ops/monitor";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Журнал ошибок" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const results: Record<string, string> = { error: "Ошибка", failed: "Не выполнено", retry: "Повтор", duplicate: "Дубль", ok: "Успешно" };
const control = "block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function JournalPage({ searchParams }: Props) {
  await requireAdminPage();
  const p = await searchParams;
  const filters: JournalFilters = {
    channel: one(p.channel) in monitorChannelLabels ? one(p.channel) : "",
    result: one(p.result) in results ? one(p.result) : "",
    operation: one(p.operation) in monitorOperationLabels ? one(p.operation) : "",
    days: [1, 7, 30, 90, 180].includes(Number(p.days)) ? Number(p.days) : 7,
    page: Math.max(1, Math.min(1000, Number(p.page) || 1)),
    q: one(p.q).trim().slice(0, 100),
  };
  let data: { items: JournalRow[]; total: number } | null = null;
  try {
    data = await listJournal(filters);
  } catch (error) {
    console.error("[admin] journal failed:", describeDbError(error));
  }
  const qs = (page: number) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page })) if (v && !(k === "page" && v === 1)) s.set(k, String(v));
    return `?${s.toString()}`;
  };

  return (
    <div className="container-page mt-8 lg:mt-10">
      <Link href="/admin/sistema" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Система и интеграции
      </Link>
      <h1 className="mt-5 text-[2rem] leading-tight">Журнал ошибок</h1>
      <p className="mt-2 text-muted">Ошибки, повторы и отсечённые дубли операций. Без токенов, заголовков и персональных данных.</p>

      <form method="get" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-[0.8125rem] text-muted">
          Канал
          <select name="channel" defaultValue={filters.channel} className={control}>
            <option value="">Все</option>
            {Object.entries(monitorChannelLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.8125rem] text-muted">
          Операция
          <select name="operation" defaultValue={filters.operation} className={control}>
            <option value="">Все</option>
            {Object.entries(monitorOperationLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.8125rem] text-muted">
          Результат
          <select name="result" defaultValue={filters.result} className={control}>
            <option value="">Все</option>
            {Object.entries(results).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.8125rem] text-muted">
          Период
          <select name="days" defaultValue={String(filters.days)} className={control}>
            {[1, 7, 30, 90, 180].map((d) => (
              <option key={d} value={d}>
                {d === 1 ? "Сутки" : `${d} дней`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.8125rem] text-muted">
          Текст
          <input name="q" type="search" defaultValue={filters.q} maxLength={100} className={control} />
        </label>
        <div className="flex items-end">
          <button type="submit" className={buttonClass("primary", "min-h-11 w-full px-5")}>
            <Search aria-hidden="true" className="h-4 w-4" />
            Показать
          </button>
        </div>
      </form>

      {!data ? (
        <p role="alert" className="mt-6 rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white px-5 py-4">
          База данных недоступна.
        </p>
      ) : data.items.length === 0 ? (
        <p className="mt-6 rounded-[var(--radius-card)] bg-white px-6 py-12 text-center text-muted">Записей нет.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-white" aria-label="Записи журнала">
          {data.items.map((row) => (
            <li key={row.id} className="px-5 py-3">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
                <span className="text-muted">{formatMoscowDateTime(row.createdAt)}</span>
                <span className="font-medium text-ink">{monitorChannelLabels[row.channel as keyof typeof monitorChannelLabels] ?? row.channel}</span>
                <span className="text-muted">{monitorOperationLabels[row.operation] ?? row.operation}</span>
                <span className={row.result === "error" || row.result === "failed" ? "font-medium text-danger" : "text-muted"}>{results[row.result] ?? row.result}</span>
                {row.ref ? <span className="text-muted">{row.ref}</span> : null}
              </p>
              {row.message ? <p className="mt-1 text-[0.9375rem] break-words text-ink">{row.message}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {data && data.total > JOURNAL_PAGE ? (
        <nav aria-label="Страницы" className="mt-6 flex items-center justify-between gap-4 text-[0.9375rem]">
          <span className="text-muted">
            Страница {filters.page} из {Math.ceil(data.total / JOURNAL_PAGE)}
          </span>
          <span className="flex gap-2">
            {filters.page > 1 ? (
              <Link href={`/admin/sistema/zhurnal${qs(filters.page - 1)}`} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
                Назад
              </Link>
            ) : null}
            {filters.page * JOURNAL_PAGE < data.total ? (
              <Link href={`/admin/sistema/zhurnal${qs(filters.page + 1)}`} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
                Далее
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
