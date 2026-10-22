import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Paperclip } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { describeAttribution } from "@/lib/requests/attribution";
import { channelLabel, paymentLabel, stageLabel } from "@/lib/requests/funnel";
import { listRequestHistory, type HistoryRecord } from "@/lib/requests/history";
import { requestNumberOf } from "@/lib/requests/number";
import { listRequestFiles, type RequestFileInfo } from "@/lib/requests/files";
import { formatFileSize } from "@/lib/request-files";
import { getRequest, listAssignees, listLossReasons, type LossReason, type RequestRecord } from "@/lib/requests/repository";
import { statusLabel } from "@/lib/requests/statuses";
import { DeleteRequest } from "@/components/admin/RequestEditor";
import { RequestWorkForm } from "@/components/admin/RequestWorkForm";
import { listDirections, type SalesDirection } from "@/lib/sales-plan/repository";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Заявка" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const fieldNames: Record<string, string> = {
  created: "Создана",
  status: "Статус",
  stage: "Этап",
  loss_reason: "Причина потери",
  assignee: "Ответственный",
  channel: "Канал",
  source_note: "Источник",
  deal_amount: "Сумма",
  currency: "Валюта",
  contract_date: "Дата договора",
  payment_status: "Оплата",
  paid_amount: "Получено",
  paid_at: "Дата оплаты",
  direction: "Направление",
};
const actorNames: Record<string, string> = { admin: "сотрудник", system: "система", site: "сайт", bot: "бот" };

function historyValue(field: string, value: string | null, reasons: LossReason[], directions: SalesDirection[] = []): string {
  if (value === null || value === "") return "—";
  if (field === "status") return statusLabel(value);
  if (field === "stage") return stageLabel(value);
  if (field === "channel" || field === "created") return channelLabel(value);
  if (field === "payment_status") return paymentLabel(value);
  if (field === "loss_reason") return reasons.find((r) => String(r.id) === value)?.title ?? value;
  if (field === "direction") return directions.find((d) => d.id === value)?.title ?? value;
  return value;
}

export default async function AdminRequestPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { id } = await params;
  const created = (await searchParams).created === "1";

  let request: RequestRecord | null;
  let history: HistoryRecord[] = [];
  let reasons: LossReason[] = [];
  let assignees: string[] = [];
  let directions: SalesDirection[] = [];
  let files: RequestFileInfo[] = [];
  try {
    request = await getRequest(id);
    if (request)
      [history, reasons, assignees, directions, files] = await Promise.all([
        listRequestHistory(request.id),
        listLossReasons(true),
        listAssignees(),
        listDirections(),
        listRequestFiles(request.id),
      ]);
  } catch (error) {
    console.error("[admin] failed to load request:", describeDbError(error));
    return (
      <div className="container-page mt-10">
        <div role="alert" className="rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6">
          <h1 className="text-[1.25rem]">База данных недоступна</h1>
          <p className="mt-2 text-muted">Не удалось загрузить заявку. Обновите страницу позже.</p>
        </div>
      </div>
    );
  }
  if (!request) notFound();

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Поступила", value: `${formatMoscowDateTime(request.createdAt)} (МСК)` },
    { label: "Имя", value: request.name },
    {
      label: "Телефон",
      value: request.phone ? (
        <a href={`tel:${request.phone.replace(/[^\d+]/g, "")}`} className="text-link">
          {request.phone}
        </a>
      ) : (
        "—"
      ),
    },
    {
      label: "Электронная почта",
      value: request.email ? (
        <a href={`mailto:${request.email}`} className="text-link break-all">
          {request.email}
        </a>
      ) : (
        "—"
      ),
    },
    {
      label: "Канал",
      value:
        request.channel !== "site" ? (
          request.chatClientId ? (
            <Link href={`/admin/obrashcheniya/${request.chatClientId}`} className="text-link">
              {request.channel === "telegram" ? "Telegram-бот" : "Чат-бот MAX"} — открыть диалог
            </Link>
          ) : (
            `${request.channel === "telegram" ? "Telegram-бот" : "Чат-бот MAX"} (карточка клиента удалена)`
          )
        ) : (
          "Форма на сайте"
        ),
    },
    { label: "Номер", value: requestNumberOf(request.id) },
    { label: "Источник посещения", value: describeAttribution(request.attribution) },
    ...(request.attribution?.landing ? [{ label: "Страница входа", value: request.attribution.landing }] : []),
    { label: "Направление", value: request.serviceTitle },
    { label: "Страница отправки", value: request.sourcePage ?? "—" },
    { label: "Контекст обращения", value: request.context ?? "—" },
    {
      label: "Согласие на обработку ПД",
      value:
        request.channel !== "site"
          ? `Дано кнопкой в боте (${request.channel === "telegram" ? "Telegram" : "MAX"}), редакция от ${request.consentRevision}`
          : `Отмечено, редакция от ${request.consentRevision}`,
    },
    { label: "Изменена", value: `${formatMoscowDateTime(request.updatedAt)} (МСК)` },
  ];

  return (
    <div className="container-page mt-8 lg:mt-10">
      <Link href="/admin" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Все заявки
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] leading-tight break-words">Заявка: {request.name}</h1>
        <StatusBadge status={request.status} />
        <span className="rounded-full border border-line-strong px-2.5 py-1 text-[0.8125rem] font-medium text-ink">{stageLabel(request.stage)}</span>
      </div>
      {created ? (
        <p role="status" className="mt-4 rounded-[var(--radius-control)] border-l-[3px] border-dark bg-white px-4 py-3 text-ink">
          Заявка создана.
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-7">
          <section aria-labelledby="request-data" className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
            <h2 id="request-data" className="text-[0.875rem] font-medium text-muted">
              Данные заявки
            </h2>
            <dl className="mt-4 divide-y divide-line border-t border-line">
              {rows.map((row) => (
                <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                  <dt className="text-[0.875rem] text-muted">{row.label}</dt>
                  <dd className="min-w-0 text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="request-message" className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
            <h2 id="request-message" className="text-[0.875rem] font-medium text-muted">
              Текст обращения
            </h2>
            <p className="mt-4 whitespace-pre-wrap break-words text-ink">{request.message}</p>
          </section>
          {files.length > 0 ? (
            <section aria-labelledby="request-files" className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
              <h2 id="request-files" className="text-[0.875rem] font-medium text-muted">
                Файлы клиента ({files.length})
              </h2>
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 py-3">
                    <Paperclip aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 break-all text-ink">{file.name}</span>
                    <span className="shrink-0 text-[0.875rem] text-muted">{formatFileSize(file.size)}</span>
                    {/* Обычная ссылка, а не Link: файл отдаётся как вложение, предзагрузка не нужна. */}
                    <a
                      href={`/api/admin/requests/${request.id}/files/${file.id}`}
                      download
                      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[0.9375rem] font-medium text-link"
                      aria-label={`Скачать ${file.name}`}
                    >
                      <Download aria-hidden="true" className="h-4 w-4" />
                      Скачать
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.8125rem] text-muted">
                Файлы прислал клиент: открывайте их с той же осторожностью, что и вложения в письмах.
              </p>
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5">
          <section aria-labelledby="request-work" className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
            <h2 id="request-work" className="text-[0.875rem] font-medium text-muted">
              Работа с заявкой
            </h2>
            <div className="mt-4">
              <RequestWorkForm request={request} lossReasons={reasons.filter((r) => r.active || r.id === request.lossReasonId)} assignees={assignees} directions={directions} />
            </div>
          </section>
          <section aria-labelledby="request-history" className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
            <h2 id="request-history" className="text-[0.875rem] font-medium text-muted">
              История изменений
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 text-[0.9375rem] text-muted">Изменений пока нет.</p>
            ) : (
              <ol className="mt-3 space-y-2 text-[0.875rem]">
                {history.map((h) => (
                  <li key={h.id} className="break-words">
                    <span className="text-muted">{formatMoscowDateTime(h.changedAt)} · {actorNames[h.actor] ?? h.actor}:</span>{" "}
                    <span className="text-ink">
                      {h.field === "created"
                        ? `заявка создана (${historyValue("created", h.newValue, reasons)})`
                        : `${fieldNames[h.field] ?? h.field}: ${historyValue(h.field, h.oldValue, reasons, directions)} → ${historyValue(h.field, h.newValue, reasons, directions)}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section aria-labelledby="request-delete" className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
            <h2 id="request-delete" className="text-[0.875rem] font-medium text-muted">
              Удаление
            </h2>
            <p className="mt-2 text-[0.875rem] text-muted">
              Удаляйте заявки, когда истёк срок их хранения или по требованию заявителя.
            </p>
            <div className="mt-4">
              <DeleteRequest id={request.id} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
