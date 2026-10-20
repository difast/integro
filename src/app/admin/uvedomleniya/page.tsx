import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { notificationTypeLabels } from "@/lib/notifications/texts";
import { listNotifications, NOTIFICATIONS_PAGE, type NotificationRecord } from "@/lib/notifications/service";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { AutoRefresh } from "@/components/admin/chat/AutoRefresh";
import { MarkReadButton } from "@/components/admin/notifications/SettingsForms";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Уведомления" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const chip =
  "inline-flex min-h-10 items-center rounded-full border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink aria-[current=page]:border-dark aria-[current=page]:bg-dark aria-[current=page]:text-white";
const channelNames: Record<string, string> = { max: "MAX", telegram: "Telegram", site: "Сайт", system: "Система", backup: "Резервная копия" };

function search(params: { type?: string; status?: string; page?: number }) {
  const q = new URLSearchParams();
  if (params.type) q.set("type", params.type);
  if (params.status) q.set("status", params.status);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function NotificationsPage({ searchParams }: Props) {
  await requireAdminPage();
  const params = await searchParams;
  const type = typeof params.type === "string" && params.type in notificationTypeLabels ? params.type : "";
  const status = params.status === "unread" || params.status === "read" ? params.status : "";
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));

  let data: { items: NotificationRecord[]; total: number } | null = null;
  try {
    data = await listNotifications({ type, status, page });
  } catch (error) {
    console.error("[admin] notifications list failed:", describeDbError(error));
  }

  return (
    <div className="container-page mt-8 lg:mt-10">
      <AutoRefresh intervalMs={20_000} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[2rem] leading-tight">Уведомления</h1>
        <div className="flex flex-wrap gap-2">
          <MarkReadButton id="all" label="Отметить все прочитанными" />
          <Link href="/admin/uvedomleniya/nastroyki" className={buttonClass("outline", "min-h-10 bg-white px-4")}>
            <Settings aria-hidden="true" className="h-4 w-4" />
            Настройки
          </Link>
        </div>
      </div>

      <nav aria-label="Статус" className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {[
            ["", "Все"],
            ["unread", "Непрочитанные"],
            ["read", "Прочитанные"],
          ].map(([value, label]) => (
            <li key={value || "all"}>
              <Link href={`/admin/uvedomleniya${search({ type, status: value })}`} aria-current={status === value ? "page" : undefined} className={chip}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Тип" className="mt-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          <li>
            <Link href={`/admin/uvedomleniya${search({ status })}`} aria-current={!type ? "page" : undefined} className={chip}>
              Все типы
            </Link>
          </li>
          {Object.entries(notificationTypeLabels).map(([value, label]) => (
            <li key={value}>
              <Link href={`/admin/uvedomleniya${search({ type: value, status })}`} aria-current={type === value ? "page" : undefined} className={chip}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!data ? (
        <p role="alert" className="mt-6 rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white px-5 py-4 text-ink">
          База данных недоступна. Обновите страницу позже.
        </p>
      ) : data.items.length === 0 ? (
        <p className="mt-6 rounded-[var(--radius-card)] bg-white px-6 py-12 text-center text-muted">Уведомлений нет.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-white" aria-label="Список уведомлений">
          {data.items.map((item) => (
            <li key={item.id} className={`flex gap-3 px-5 py-4 ${item.readAt ? "" : "bg-bronze-soft/50"}`}>
              <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-danger"}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {item.link ? (
                    <Link href={item.link} className="font-medium break-words text-ink hover:text-bronze-deep">
                      {item.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{item.title}</span>
                  )}
                  <span className="text-[0.75rem] text-muted">
                    {notificationTypeLabels[item.type]} · {channelNames[item.channel] ?? item.channel}
                  </span>
                </span>
                {item.body ? <span className="mt-1 block text-[0.9375rem] break-words text-muted">{item.body}</span> : null}
                <span className="mt-1.5 flex flex-wrap items-center gap-3 text-[0.8125rem] text-muted">
                  {formatMoscowDateTime(item.createdAt)}
                  {item.readAt ? null : <MarkReadButton id={item.id} />}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > NOTIFICATIONS_PAGE ? (
        <nav aria-label="Страницы" className="mt-6 flex items-center justify-between gap-4 text-[0.9375rem]">
          <span className="text-muted">
            Страница {page} из {Math.ceil(data.total / NOTIFICATIONS_PAGE)}
          </span>
          <span className="flex gap-2">
            {page > 1 ? (
              <Link href={`/admin/uvedomleniya${search({ type, status, page: page - 1 })}`} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
                Назад
              </Link>
            ) : null}
            {page * NOTIFICATIONS_PAGE < data.total ? (
              <Link href={`/admin/uvedomleniya${search({ type, status, page: page + 1 })}`} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
                Далее
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
