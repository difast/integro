import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, Search, Settings } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { getMaxConfig, isMaxEnabled } from "@/lib/max/config";
import { maxDialogFilters, maxFiltersToSearch, maxPeriods, parseMaxFilters, type MaxFilters } from "@/lib/max/filters";
import { countMaxNeedsReply, listMaxClients } from "@/lib/max/repository";
import { maxDisplayName } from "@/lib/max/types";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { AutoRefresh } from "@/components/admin/max/AutoRefresh";
import { DialogBadges } from "@/components/admin/max/badges";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "MAX — обращения" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const controlClass =
  "block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";
const chip =
  "inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink aria-[current=page]:border-dark aria-[current=page]:bg-dark aria-[current=page]:text-white";

async function load(filters: MaxFilters) {
  try {
    const [list, needsReply] = await Promise.all([listMaxClients(filters), countMaxNeedsReply()]);
    return { list, needsReply, failed: false as const };
  } catch (error) {
    console.error("[admin] failed to load max dialogs:", describeDbError(error));
    return { failed: true as const };
  }
}

export default async function AdminMaxPage({ searchParams }: Props) {
  await requireAdminPage();
  const params = await searchParams;
  const filters = parseMaxFilters(params);
  const data = await load(filters);
  const enabled = isMaxEnabled(getMaxConfig());

  if (data.failed) {
    return (
      <div className="container-page mt-10">
        <div role="alert" className="rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6">
          <h1 className="text-[1.25rem]">База данных недоступна</h1>
          <p className="mt-2 text-muted">Не удалось получить обращения из MAX. Обновите страницу позже.</p>
        </div>
      </div>
    );
  }
  const { list, needsReply } = data;

  return (
    <div className="container-page mt-8 lg:mt-10">
      <AutoRefresh intervalMs={20_000} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[2rem] leading-tight">MAX — обращения</h1>
          <p className="mt-2 text-muted">
            Ждут ответа: <span className="font-medium text-ink">{needsReply}</span> · всего найдено: {list.total}
          </p>
        </div>
        <Link href="/admin/max/nastroyki" className={buttonClass("outline", "min-h-11 bg-white px-4")}>
          <Settings aria-hidden="true" className="h-4 w-4" />
          Настройки MAX
        </Link>
      </div>

      {!enabled ? (
        <p role="status" className="mt-6 rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-white px-4 py-3 text-ink">
          Чат-бот MAX не подключён на сервере — новые обращения не поступают. Порядок подключения — в разделе{" "}
          <Link href="/admin/max/nastroyki" className="text-link">
            «Настройки MAX»
          </Link>
          .
        </p>
      ) : null}
      {params.deleted === "1" ? (
        <p role="status" className="mt-6 rounded-[var(--radius-control)] border-l-[3px] border-dark bg-white px-4 py-3 text-ink">
          Карточка клиента и переписка удалены.
        </p>
      ) : null}

      <nav aria-label="Фильтр по статусу" className="mt-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {maxDialogFilters.map((item) => (
            <li key={item.value || "all"}>
              <Link
                href={`/admin/max${maxFiltersToSearch({ ...filters, page: 1, filter: item.value })}`}
                aria-current={filters.filter === item.value ? "page" : undefined}
                className={chip}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form role="search" action="/admin/max" method="get" className="mt-4 flex flex-col gap-3 lg:flex-row">
        {filters.filter ? <input type="hidden" name="filter" value={filters.filter} /> : null}
        <label htmlFor="q" className="sr-only">
          Поиск по имени, идентификатору MAX, телефону или тексту сообщений
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={100}
          placeholder="Имя, ID MAX, телефон или текст сообщения"
          className={`${controlClass} lg:max-w-md`}
        />
        <label htmlFor="period" className="sr-only">
          Период последней активности
        </label>
        <select id="period" name="period" defaultValue={filters.period} className={`${controlClass} lg:max-w-[12rem]`}>
          {maxPeriods.map((period) => (
            <option key={period.value || "all"} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("primary", "min-h-11 px-5")}>
            <Search aria-hidden="true" className="h-4 w-4" />
            Найти
          </button>
          {filters.q || filters.period ? (
            <Link href={`/admin/max${maxFiltersToSearch({ filter: filters.filter })}`} className={buttonClass("outline", "min-h-11 bg-white px-4")}>
              Сбросить
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] bg-white">
        {list.items.length === 0 ? (
          <p className="px-6 py-12 text-center text-muted">
            {filters.q || filters.filter || filters.period ? "По заданным условиям обращений не найдено." : "Обращений из MAX пока нет."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {list.items.map((item) => {
              const name = maxDisplayName({ first_name: item.firstName, last_name: item.lastName, username: item.username }) || "Без имени";
              return (
                <li key={item.id}>
                  <Link href={`/admin/max/${item.id}`} className="flex gap-4 px-5 py-4 transition-colors hover:bg-mist/50">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium text-ink">{name}</span>
                        <span className="text-[0.8125rem] text-muted">ID {item.maxUserId}</span>
                        {item.requestCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[0.8125rem] text-ink">
                            <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                            Заявок: {item.requestCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-[0.9375rem] text-muted">
                        {item.lastMessageDirection === "out" ? "Ответ: " : ""}
                        {item.lastMessagePreview ?? "—"}
                      </span>
                      <span className="mt-2 block">
                        <DialogBadges status={item.status} mode={item.mode} needsReply={item.needsReply} botBlocked={item.botBlocked} />
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end justify-between gap-2 text-[0.8125rem] whitespace-nowrap text-muted">
                      {formatMoscowDateTime(item.lastSeenAt)}
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {list.pageCount > 1 ? (
        <nav aria-label="Страницы" className="mt-6 flex items-center justify-between gap-4 text-[0.9375rem]">
          <span className="text-muted">
            Страница {filters.page} из {list.pageCount}
          </span>
          <span className="flex gap-2">
            {filters.page > 1 ? (
              <Link href={`/admin/max${maxFiltersToSearch({ ...filters, page: filters.page - 1 })}`} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
                Назад
              </Link>
            ) : null}
            {filters.page < list.pageCount ? (
              <Link href={`/admin/max${maxFiltersToSearch({ ...filters, page: filters.page + 1 })}`} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
                Далее
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
