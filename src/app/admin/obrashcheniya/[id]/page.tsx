import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Paperclip } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { getAdapter } from "@/lib/chat/registry";
import {
  getChatClient,
  listChatMessages,
  listChatNotes,
  listLinkedClients,
  searchLinkCandidates,
  type ChatClient,
  type ChatClientListItem,
  type ChatMessageRecord,
  type ChatNote,
} from "@/lib/chat/repository";
import { channelLabels, chatDisplayName } from "@/lib/chat/types";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { listRequestsByChatClient, type RequestListItem } from "@/lib/requests/repository";
import { AutoRefresh } from "@/components/admin/chat/AutoRefresh";
import { ChannelBadge, DialogBadges } from "@/components/admin/chat/badges";
import { ChatScroller } from "@/components/admin/chat/ChatScroller";
import { DeleteClient } from "@/components/admin/chat/DeleteClient";
import { DialogControls } from "@/components/admin/chat/DialogControls";
import { LinkClients } from "@/components/admin/chat/LinkClients";
import { NoteForm } from "@/components/admin/chat/NoteForm";
import { ReplyForm } from "@/components/admin/chat/ReplyForm";
import { RetryButton } from "@/components/admin/chat/RetryButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ManualRequestForm } from "@/components/admin/ManualRequestForm";
import { services } from "@/config/services";

export const metadata: Metadata = { title: "Диалог" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const sendStatusText: Record<ChatMessageRecord["status"], string> = {
  received: "",
  pending: "В очереди на отправку",
  sending: "Отправляется…",
  sent: "Отправлено, платформа подтвердила",
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

function Attachments({ items }: { items: ChatMessageRecord["attachments"] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {items.map((item, index) => {
        if (item.type === "remove_keyboard") return null;
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
          document: "Документ",
          voice: "Голосовое сообщение",
          video_note: "Видеосообщение",
          animation: "Анимация",
          venue: "Место",
          poll: "Опрос",
          dice: "Кубик",
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

function MessageBubble({ message, clientId, clientName }: { message: ChatMessageRecord; clientId: string; clientName: string }) {
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
          {message.kind !== "callback" && message.externalMessageId && /^\d+$/.test(message.externalMessageId) ? ` · № ${message.externalMessageId}` : ""}
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

async function load(id: string, before: string | null, linkQuery: string) {
  try {
    const client = await getChatClient(id);
    if (!client) return { client: null };
    const [messages, notes, requests, linked, candidates] = await Promise.all([
      listChatMessages(id, before),
      listChatNotes(id),
      listRequestsByChatClient(id),
      listLinkedClients(id),
      searchLinkCandidates(id, linkQuery),
    ]);
    return { client, messages, notes, requests, linked, candidates };
  } catch (error) {
    console.error("[admin] failed to load chat dialog:", describeDbError(error));
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

export default async function AdminChatDialogPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { id } = await params;
  const query = await searchParams;
  const before = typeof query.before === "string" ? query.before : null;
  const linkQuery = typeof query.link === "string" ? query.link.trim().slice(0, 100) : "";
  const data = await load(id, before, linkQuery);

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
  const { client, messages, notes, requests, linked, candidates } = data as {
    client: ChatClient;
    messages: { items: ChatMessageRecord[]; hasMore: boolean };
    notes: ChatNote[];
    requests: RequestListItem[];
    linked: ChatClientListItem[];
    candidates: ChatClientListItem[];
  };

  const label = channelLabels[client.channel];
  const name = chatDisplayName(client) || "Без имени";
  const enabled = getAdapter(client.channel).isEnabled();
  const disabledReason = !enabled
    ? `${label} не настроен на сервере — отправка недоступна. См. «Настройки каналов».`
    : client.botBlocked
      ? `Клиент остановил или заблокировал бота. ${label} не доставит сообщение, пока клиент снова не напишет боту.`
      : null;
  const toCard = (item: ChatClientListItem) => ({
    id: item.id,
    name: chatDisplayName(item) || "Без имени",
    channelLabel: channelLabels[item.channel],
    externalUserId: item.externalUserId,
  });

  const info: { label: string; value: ReactNode }[] = [
    { label: "Канал", value: label },
    { label: `ID пользователя ${label}`, value: client.externalUserId },
    { label: "ID чата", value: client.chatId ?? "—" },
    { label: `Имя в ${label}`, value: [client.firstName, client.lastName].filter(Boolean).join(" ") || "—" },
    { label: "Username", value: client.username ? `@${client.username}` : "—" },
    { label: "Телефон (указал клиент)", value: client.phone || "—" },
    { label: "Источник", value: client.source ? `метка запуска «${client.source}»` : "не определён" },
    { label: "Первое обращение", value: formatMoscowDateTime(client.firstSeenAt) },
    { label: "Последняя активность", value: formatMoscowDateTime(client.lastSeenAt) },
    { label: "Последнее сообщение", value: client.lastMessageAt ? formatMoscowDateTime(client.lastMessageAt) : "—" },
    { label: "Шаг сценария", value: client.flowStep ? (stepText[client.flowStep] ?? client.flowStep) : "—" },
    {
      label: "Напоминания о заявке",
      value:
        client.reminderStage === 0
          ? "не отправлялись"
          : `отправлено ${client.reminderStage} из 2${client.lastReminderAt ? `, последнее ${formatMoscowDateTime(client.lastReminderAt)}` : ""}`,
    },
    {
      label: "Опрос после закрытия",
      value: client.surveyDueAt
        ? `запланирован на ${formatMoscowDateTime(client.surveyDueAt)}`
        : client.surveySentAt
          ? `отправлен ${formatMoscowDateTime(client.surveySentAt)}`
          : "—",
    },
    {
      label: "Согласие на обработку ПД",
      value: client.consentAt ? `Дано в боте ${formatMoscowDateTime(client.consentAt)}, редакция от ${client.consentRevision}` : "Не давалось",
    },
  ];

  return (
    <div className="container-page mt-8 lg:mt-10">
      <AutoRefresh />
      <Link href="/admin/obrashcheniya" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Все обращения
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] leading-tight">{name}</h1>
        <ChannelBadge channel={client.channel} />
        <DialogBadges status={client.status} mode={client.mode} needsReply={client.needsReply} botBlocked={client.botBlocked} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        {/* Переписка и ответ — одно окно: история прокручивается внутри, поле ответа всегда под ней.
            На широком экране окно закреплено и не уезжает при прокрутке правой колонки. */}
        <div className="min-w-0 lg:col-span-7 lg:sticky lg:top-4 lg:self-start">
          <section
            aria-labelledby="dialog"
            className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-white lg:h-[calc(100vh-18rem)] lg:min-h-[420px]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <h2 id="dialog" className="text-[0.875rem] font-medium text-muted">
                Переписка
              </h2>
              {messages.hasMore ? (
                <Link href={`/admin/obrashcheniya/${client.id}?before=${messages.items[0]?.id ?? ""}`} className="text-[0.8125rem] text-link">
                  Более ранние сообщения
                </Link>
              ) : null}
            </div>
            <ChatScroller
              lastId={messages.items.at(-1)?.id ?? ""}
              startAtBottom={!before}
              className="h-[calc(100svh-35rem)] min-h-[200px] overflow-y-auto bg-mist/60 px-3 py-4 focus:outline-none sm:px-5 lg:h-auto lg:min-h-0 lg:flex-1"
            >
              {before ? (
                <p className="mb-3 text-center">
                  <Link href={`/admin/obrashcheniya/${client.id}`} className="text-[0.875rem] text-link">
                    К последним сообщениям
                  </Link>
                </p>
              ) : null}
              {messages.items.length === 0 ? (
                <p className="text-muted">Сообщений нет.</p>
              ) : (
                <ol className="space-y-3" aria-label="Сообщения по времени">
                  {messages.items.map((message) => (
                    <MessageBubble key={message.id} message={message} clientId={client.id} clientName={name} />
                  ))}
                </ol>
              )}
            </ChatScroller>
            <div id="reply-section" className="shrink-0 border-t border-line px-4 py-4 sm:px-5">
              <ReplyForm clientId={client.id} channelLabel={label} disabledReason={disabledReason} />
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5">
          <Section id="dialog-controls" title="Управление диалогом">
            <DialogControls
              clientId={client.id}
              mode={client.mode}
              status={client.status}
              needsReply={client.needsReply}
              qualified={client.qualifiedAt !== null}
              hasRequest={requests.length > 0}
            />
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
              <p className="text-[0.9375rem] text-muted">Заявок по этому диалогу нет.</p>
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
          <Section id="new-request" title="Создать заявку из диалога">
            <details>
              <summary className="cursor-pointer text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
                Оформить заявку вручную
              </summary>
              <p className="mt-2 text-[0.8125rem] text-muted">
                Если клиент договорился с оператором в переписке, не проходя сценарий бота. Канал — {label}, заявка
                будет привязана к этой карточке.
              </p>
              <div className="mt-4">
                <ManualRequestForm
                  channels={[]}
                  services={services.map((s) => ({ value: s.slug, label: s.title }))}
                  chatClientId={client.id}
                  defaults={{ name: chatDisplayName(client) || "", phone: client.phone ?? "" }}
                />
              </div>
            </details>
          </Section>
          <Section id="linked" title="Тот же человек в других каналах">
            <LinkClients clientId={client.id} linked={linked.map(toCard)} candidates={candidates.map(toCard)} query={linkQuery} />
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
              По требованию клиента или по истечении срока хранения. Переписка в самом {label} при этом не удаляется.
            </p>
            <DeleteClient clientId={client.id} />
          </Section>
        </div>
      </div>
    </div>
  );
}
