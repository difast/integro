import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Paperclip } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { getMaxConfig, isMaxEnabled } from "@/lib/max/config";
import {
  getMaxClient,
  listMaxMessages,
  listMaxNotes,
  type MaxClient,
  type MaxMessageRecord,
  type MaxNote,
} from "@/lib/max/repository";
import { maxDisplayName } from "@/lib/max/types";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { listRequestsByMaxClient, type RequestListItem } from "@/lib/requests/repository";
import { AutoRefresh } from "@/components/admin/max/AutoRefresh";
import { DialogBadges } from "@/components/admin/max/badges";
import { DeleteClient } from "@/components/admin/max/DeleteClient";
import { DialogControls } from "@/components/admin/max/DialogControls";
import { NoteForm } from "@/components/admin/max/NoteForm";
import { ReplyForm } from "@/components/admin/max/ReplyForm";
import { RetryButton } from "@/components/admin/max/RetryButton";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Диалог MAX" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const sendStatusText: Record<MaxMessageRecord["status"], string> = {
  received: "",
  pending: "В очереди на отправку",
  sending: "Отправляется…",
  sent: "Отправлено в MAX",
  failed: "Не отправлено",
  unknown: "Результат отправки неизвестен",
};

const stepText: Record<string, string> = {
  menu: "главное меню",
  consent: "заявка: согласие",
  name: "заявка: имя",
  direction: "заявка: направление",
  description: "заявка: описание",
  phone: "заявка: телефон",
  contact_time: "заявка: время связи",
  confirm: "заявка: проверка",
  edit: "заявка: исправление",
  specialist: "ждёт специалиста",
};

function formatSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} МБ`;
  if (size >= 1024) return `${Math.round(size / 1024)} КБ`;
  return `${size} Б`;
}

function Attachments({ items }: { items: MaxMessageRecord["attachments"] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {items.map((item, index) => {
        if (item.type === "inline_keyboard" && "buttons" in item && Array.isArray(item.buttons)) {
          return (
            <div key={index} className="flex flex-wrap gap-1.5" aria-label="Кнопки сообщения">
              {item.buttons.flat().map((button, i) => (
                <span key={i} className="rounded-full border border-current/30 px-2.5 py-1 text-[0.75rem] opacity-80">
                  {button.text}
                </span>
              ))}
            </div>
          );
        }
        const meta = item as { type: string; filename?: string; size?: number };
        const label: Record<string, string> = {
          image: "Изображение",
          video: "Видео",
          audio: "Аудио",
          file: "Файл",
          sticker: "Стикер",
          contact: "Контакт",
          location: "Геопозиция",
          share: "Ссылка",
        };
        return (
          <p key={index} className="flex items-center gap-1.5 text-[0.8125rem] opacity-80">
            <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
            {label[meta.type] ?? meta.type}
            {meta.filename ? `: ${meta.filename}` : ""}
            {typeof meta.size === "number" ? ` (${formatSize(meta.size)})` : ""}
            {" — файл не загружается и не хранится на сайте"}
          </p>
        );
      })}
    </div>
  );
}

function MessageBubble({ message, clientId, clientName }: { message: MaxMessageRecord; clientId: string; clientName: string }) {
  const incoming = message.direction === "in";
  const author = incoming ? clientName : message.author === "operator" ? "Оператор" : "Бот";
  const system = incoming && (message.kind === "start" || message.kind === "stop" || message.kind === "callback");
  return (
    <li className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-[var(--radius-card)] px-4 py-3 ${
          incoming
            ? system
              ? "border border-dashed border-line-strong bg-white text-muted"
              : "bg-white text-ink"
            : message.author === "operator"
              ? "bg-dark text-white"
              : "bg-mist-deep text-ink"
        }`}
      >
        <p className={`text-[0.75rem] ${incoming || message.author !== "operator" ? "text-muted" : "text-on-dark"}`}>
          {author} · {formatMoscowDateTime(incoming ? message.eventTime : (message.sentAt ?? message.createdAt))}
        </p>
        {message.text ? <p className="mt-1 text-[0.9375rem] whitespace-pre-wrap break-words">{message.text}</p> : null}
        <Attachments items={message.attachments} />
        {!incoming ? (
          <p
            className={`mt-2 text-[0.75rem] font-medium ${
              message.status === "failed" || message.status === "unknown"
                ? message.author === "operator"
                  ? "text-[#f3c1b8]"
                  : "text-danger"
                : "opacity-70"
            }`}
          >
            {sendStatusText[message.status]}
            {message.error ? `: ${message.error}` : ""}
          </p>
        ) : null}
        {!incoming && (message.status === "failed" || message.status === "unknown") ? (
          <div className="rounded-[var(--radius-control)] bg-white p-2 text-ink">
            <RetryButton clientId={clientId} messageId={message.id} unknown={message.status === "unknown"} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

async function load(id: string, before: string | null) {
  try {
    const client = await getMaxClient(id);
    if (!client) return { client: null };
    const [messages, notes, requests] = await Promise.all([listMaxMessages(id, before), listMaxNotes(id), listRequestsByMaxClient(id)]);
    return { client, messages, notes, requests };
  } catch (error) {
    console.error("[admin] failed to load max dialog:", describeDbError(error));
    return { failed: true as const };
  }
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[var(--radius-card)] bg-white p-6">
      <h2 id={id} className="text-[0.875rem] font-medium text-muted">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminMaxDialogPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { id } = await params;
  const beforeParam = (await searchParams).before;
  const before = typeof beforeParam === "string" ? beforeParam : null;
  const data = await load(id, before);

  if ("failed" in data) {
    return (
      <div className="container-page mt-10">
        <div role="alert" className="rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6">
          <h1 className="text-[1.25rem]">База данных недоступна</h1>
          <p className="mt-2 text-muted">Не удалось загрузить диалог. Обновите страницу позже.</p>
        </div>
      </div>
    );
  }
  if (!data.client) notFound();
  const { client, messages, notes, requests } = data as {
    client: MaxClient;
    messages: { items: MaxMessageRecord[]; hasMore: boolean };
    notes: MaxNote[];
    requests: RequestListItem[];
  };

  const name = maxDisplayName({ first_name: client.firstName, last_name: client.lastName, username: client.username }) || "Без имени";
  const enabled = isMaxEnabled(getMaxConfig());
  const disabledReason = !enabled
    ? "Чат-бот MAX не настроен на сервере — отправка недоступна. См. «Настройки MAX»."
    : client.botBlocked
      ? "Клиент остановил бота или удалил диалог. MAX не доставит сообщение, пока клиент снова не напишет боту."
      : null;

  const info: { label: string; value: ReactNode }[] = [
    { label: "ID пользователя MAX", value: client.maxUserId },
    { label: "Имя в MAX", value: [client.firstName, client.lastName].filter(Boolean).join(" ") || "—" },
    { label: "Username", value: client.username ? `@${client.username}` : "—" },
    { label: "Телефон (указал клиент)", value: client.phone || "—" },
    { label: "Источник", value: client.source ? `метка запуска «${client.source}»` : "не определён" },
    { label: "Первое обращение", value: formatMoscowDateTime(client.firstSeenAt) },
    { label: "Последняя активность", value: formatMoscowDateTime(client.lastSeenAt) },
    { label: "Последнее сообщение", value: client.lastMessageAt ? formatMoscowDateTime(client.lastMessageAt) : "—" },
    { label: "Шаг сценария", value: client.flowStep ? (stepText[client.flowStep] ?? client.flowStep) : "—" },
    {
      label: "Согласие на обработку ПД",
      value: client.consentAt ? `Дано в чат-боте ${formatMoscowDateTime(client.consentAt)}, редакция от ${client.consentRevision}` : "Не давалось",
    },
  ];

  return (
    <div className="container-page mt-8 lg:mt-10">
      <AutoRefresh />
      <Link href="/admin/max" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Все обращения MAX
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] leading-tight">{name}</h1>
        <DialogBadges status={client.status} mode={client.mode} needsReply={client.needsReply} botBlocked={client.botBlocked} />
        <a href="#reply" className="text-[0.9375rem] text-link">
          К ответу
        </a>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-7">
          <section aria-labelledby="dialog" className="rounded-[var(--radius-card)] bg-mist/60 p-4 sm:p-6">
            <h2 id="dialog" className="text-[0.875rem] font-medium text-muted">
              Переписка
            </h2>
            {messages.hasMore ? (
              <p className="mt-3 text-center">
                <Link href={`/admin/max/${client.id}?before=${messages.items[0]?.id ?? ""}`} className="text-[0.875rem] text-link">
                  Показать более ранние сообщения
                </Link>
              </p>
            ) : null}
            {before ? (
              <p className="mt-3 text-center">
                <Link href={`/admin/max/${client.id}`} className="text-[0.875rem] text-link">
                  К последним сообщениям
                </Link>
              </p>
            ) : null}
            {messages.items.length === 0 ? (
              <p className="mt-4 text-muted">Сообщений нет.</p>
            ) : (
              <ol className="mt-4 space-y-3" aria-label="Сообщения по времени">
                {messages.items.map((message) => (
                  <MessageBubble key={message.id} message={message} clientId={client.id} clientName={name} />
                ))}
              </ol>
            )}
          </section>
          <Section id="reply-section" title="Ответ">
            <ReplyForm clientId={client.id} disabledReason={disabledReason} />
          </Section>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5">
          <Section id="dialog-controls" title="Управление диалогом">
            <DialogControls clientId={client.id} mode={client.mode} status={client.status} needsReply={client.needsReply} />
          </Section>
          <Section id="client" title="Клиент">
            <dl className="divide-y divide-line border-t border-line">
              {info.map((row) => (
                <div key={row.label} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
                  <dt className="text-[0.8125rem] text-muted">{row.label}</dt>
                  <dd className="min-w-0 text-[0.9375rem] break-words text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
          <Section id="requests" title={`Заявки (${requests.length})`}>
            {requests.length === 0 ? (
              <p className="text-[0.9375rem] text-muted">Заявок из чат-бота нет.</p>
            ) : (
              <ul className="divide-y divide-line">
                {requests.map((request) => (
                  <li key={request.id}>
                    <Link href={`/admin/zayavki/${request.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-bronze-deep">
                      <span className="min-w-0">
                        <span className="block text-[0.9375rem] text-ink">{request.serviceTitle}</span>
                        <span className="text-[0.8125rem] text-muted">{formatMoscowDateTime(request.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge status={request.status} />
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section id="notes-section" title="Внутренние заметки">
            <NoteForm clientId={client.id} />
            {notes.length ? (
              <ul className="mt-5 space-y-3">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-[var(--radius-control)] bg-mist px-4 py-3">
                    <p className="text-[0.75rem] text-muted">{formatMoscowDateTime(note.createdAt)}</p>
                    <p className="mt-1 text-[0.9375rem] whitespace-pre-wrap break-words text-ink">{note.body}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
          <Section id="delete" title="Удаление">
            <p className="mb-4 text-[0.875rem] text-muted">
              По требованию клиента или по истечении срока хранения. Переписка в самом MAX при этом не удаляется.
            </p>
            <DeleteClient clientId={client.id} />
          </Section>
        </div>
      </div>
    </div>
  );
}
