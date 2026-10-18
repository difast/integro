import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Download, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { filtersToSearch, parseFilters, type RequestFilters } from "@/lib/requests/filters";
import { countRequests, listRequests } from "@/lib/requests/repository";
import { requestStatuses } from "@/lib/requests/statuses";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buttonClass } from "@/components/ui/Button";
import { logoutEverywhere } from "./actions";

export const metadata: Metadata = { title: "Заявки" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const controlClass =
  "block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";

async function loadData(filters: RequestFilters) {
  try {
    const [counts, list] = await Promise.all([countRequests(), listRequests(filters)]);
    return { counts, list, failed: false as const };
  } catch (error) {
    console.error("[admin] failed to load requests:", describeDbError(error));
    return { failed: true as const };
  }
}

export default async function AdminRequestsPage({ searchParams }: Props) {
  await requireAdminPage();
  const params = await searchParams;
  const filters = parseFilters(params);
  const data = await loadData(filters);

  if (data.failed) {
    return (
      <div className="container-page mt-10">
        <div role="alert" className="rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6">
          <h1 className="text-[1.25rem]">База данных недоступна</h1>
          <p className="mt-2 text-muted">
            Не удалось получить заявки. Проверьте переменную DATABASE_URL и доступность базы в панели Timeweb, затем
            обновите страницу.
          </p>
        </div>
      </div>
    );
  }

  const { counts, list } = data;
  const newCount = counts.byStatus.new ?? 0;
  const exportFiltered = `/api/admin/export${filtersToSearch({ q: filters.q, status: filters.status, sort: filters.sort })}`;
  const hasFilters = Boolean(filters.q || filters.status);
  const sortLink = filtersToSearch({ ...filters, page: 1, sort: filters.sort === "new" ? "old" : "new" });

  return (
    <div className="container-page mt-8 lg:mt-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[2rem] leading-tight">Заявки</h1>
          <dl className="mt-4 flex flex-wrap gap-3">
            <div className="rounded-[var(--radius-card)] bg-dark px-5 py-3 text-white">
              <dt className="text-[0.8125rem] text-on-dark">Новые</dt>
              <dd className="text-[1.5rem] leading-tight font-medium">{newCount}</dd>
            </div>
            <div className="rounded-[var(--radius-card)] bg-white px-5 py-3">
              <dt className="text-[0.8125rem] text-muted">Всего</dt>
              <dd className="text-[1.5rem] leading-tight font-medium text-ink">{counts.total}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasFilters ? (
            <a href={exportFiltered} className={buttonClass("outline", "min-h-11 bg-white px-4")}>
              <Download aria-hidden="true" className="h-4 w-4" />
              CSV: текущая выборка
            </a>
          ) : null}
          <a href="/api/admin/export" className={buttonClass("outline", "min-h-11 bg-white px-4")}>
            <Download aria-hidden="true" className="h-4 w-4" />
            CSV: все заявки
          </a>
        </div>
      </div>

      {params.deleted === "1" ? (
        <p role="status" className="mt-6 rounded-[var(--radius-control)] border-l-[3px] border-dark bg-white px-4 py-3 text-ink">
          Заявка удалена.
        </p>
      ) : null}

      <nav aria-label="Фильтр по статусу" className="mt-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          <li>
            <Link
              href={`/admin${filtersToSearch({ q: filters.q, sort: filters.sort })}`}
              aria-current={!filters.status ? "page" : undefined}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink aria-[current=page]:border-dark aria-[current=page]:bg-dark aria-[current=page]:text-white"
            >
              Все <span className="opacity-70">{counts.total}</span>
            </Link>
          </li>
          {requestStatuses.map((status) => (
            <li key={status.value}>
              <Link
                href={`/admin${filtersToSearch({ q: filters.q, sort: filters.sort, status: status.value })}`}
                aria-current={filters.status === status.value ? "page" : undefined}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink aria-[current=page]:border-dark aria-[current=page]:bg-dark aria-[current=page]:text-white"
              >
                {status.label} <span className="opacity-70">{counts.byStatus[status.value] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form role="search" action="/admin" method="get" className="mt-4 flex flex-col gap-3 sm:flex-row">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        {filters.sort === "old" ? <input type="hidden" name="sort" value="old" /> : null}
        <label htmlFor="q" className="sr-only">
          Поиск по имени, телефону или электронной почте
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={100}
          placeholder="Имя, телефон или электронная почта"
          className={`${controlClass} sm:max-w-md`}
        />
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("primary", "min-h-11 px-5")}>
            <Search aria-hidden="true" className="h-4 w-4" />
            Найти
          </button>
          {filters.q ? (
            <Link href={`/admin${filtersToSearch({ status: filters.status, sort: filters.sort })}`} className={buttonClass("outline", "min-h-11 bg-white px-4")}>
              Сбросить
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] bg-white">
        {list.items.length === 0 ? (
          <p className="px-6 py-12 text-center text-muted">
            {hasFilters ? "По заданным условиям заявок не найдено." : "Заявок пока нет."}
          </p>
        ) : (
          // relative: скрытые подписи (sr-only) позиционируются внутри прокручиваемой области.
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-b border-line text-[0.8125rem] text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">
                    <Link href={`/admin${sortLink}`} className="inline-flex items-center gap-1 hover:text-ink">
                      Дата
                      {filters.sort === "new" ? (
                        <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      <span className="sr-only">
                        {filters.sort === "new" ? "(сначала новые, изменить)" : "(сначала старые, изменить)"}
                      </span>
                    </Link>
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">Имя</th>
                  <th scope="col" className="px-5 py-3 font-medium">Телефон</th>
                  <th scope="col" className="px-5 py-3 font-medium">Услуга</th>
                  <th scope="col" className="px-5 py-3 font-medium">Статус</th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    <span className="sr-only">Действие</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0 hover:bg-mist/50">
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted">{formatMoscowDateTime(item.createdAt)}</td>
                    <td className="px-5 py-3.5 font-medium text-ink">{item.name}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">{item.phone || "—"}</td>
                    <td className="px-5 py-3.5">{item.serviceTitle}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/zayavki/${item.id}`}
                        className="inline-flex items-center gap-1 font-medium text-ink underline decoration-bronze underline-offset-4 hover:text-bronze-deep"
                      >
                        Открыть
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                        <span className="sr-only">заявку: {item.name}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {list.pageCount > 1 ? (
        <nav aria-label="Страницы" className="mt-6 flex items-center justify-between gap-4 text-[0.9375rem]">
          <span className="text-muted">
            Страница {filters.page} из {list.pageCount} · найдено {list.total}
          </span>
          <span className="flex gap-2">
            {filters.page > 1 ? (
              <Link href={`/admin${filtersToSearch({ ...filters, page: filters.page - 1 })}`} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
                Назад
              </Link>
            ) : null}
            {filters.page < list.pageCount ? (
              <Link href={`/admin${filtersToSearch({ ...filters, page: filters.page + 1 })}`} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
                Далее
              </Link>
            ) : null}
          </span>
        </nav>
      ) : hasFilters ? (
        <p className="mt-4 text-[0.875rem] text-muted">Найдено: {list.total}</p>
      ) : null}

      <form action={logoutEverywhere} className="mt-12 border-t border-line pt-6">
        <button type="submit" className="text-[0.875rem] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
          Завершить все сессии администратора
        </button>
        <span className="ml-2 text-[0.8125rem] text-muted">— например, после смены пароля или входа с чужого устройства.</span>
      </form>
    </div>
  );
}
