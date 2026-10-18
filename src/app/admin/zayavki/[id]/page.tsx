import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { getRequest, type RequestRecord } from "@/lib/requests/repository";
import { DeleteRequest, RequestEditor } from "@/components/admin/RequestEditor";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Заявка" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminRequestPage({ params }: Props) {
  await requireAdminPage();
  const { id } = await params;

  let request: RequestRecord | null;
  try {
    request = await getRequest(id);
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
    { label: "Направление", value: request.serviceTitle },
    { label: "Страница отправки", value: request.sourcePage ?? "—" },
    { label: "Согласие на обработку ПД", value: `Отмечено, редакция от ${request.consentRevision}` },
    { label: "Изменена", value: `${formatMoscowDateTime(request.updatedAt)} (МСК)` },
  ];

  return (
    <div className="container-page mt-8 lg:mt-10">
      <Link href="/admin" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Все заявки
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] leading-tight">Заявка: {request.name}</h1>
        <StatusBadge status={request.status} />
      </div>

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
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5">
          <section aria-labelledby="request-work" className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
            <h2 id="request-work" className="text-[0.875rem] font-medium text-muted">
              Работа с заявкой
            </h2>
            <div className="mt-4">
              <RequestEditor id={request.id} status={request.status} notes={request.notes} />
            </div>
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
