import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, CircleDashed, ListChecks } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getBackupConfig, isScheduledBackupEnabled } from "@/lib/backup/config";
import { listBackupRuns, type BackupRun } from "@/lib/backup/run";
import { describeDbError } from "@/lib/db";
import { getMaxConfig, isMaxEnabled } from "@/lib/max/config";
import { getPushConfig } from "@/lib/notifications/config";
import {
  getChannelHealth,
  getIntegrationStatuses,
  getNotificationHealth,
  listFailedOperations,
  type ChannelHealth,
  type FailedOperation,
  type NotificationHealth,
  type StatusRow,
} from "@/lib/ops/dashboard";
import { monitorChannelLabels } from "@/lib/ops/monitor";
import { getRetentionSettings, type RetentionSettings } from "@/lib/ops/retention";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { getTelegramConfig, isTelegramEnabled } from "@/lib/telegram/config";
import { AutoRefresh } from "@/components/admin/chat/AutoRefresh";
import { BackupButtons, CheckNow, RetentionForm, RetryOperation } from "@/components/admin/system/SystemForms";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Система и интеграции" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const periods = [
  { value: "1", label: "Сутки" },
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
];
const chip =
  "inline-flex min-h-10 items-center rounded-full border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink aria-[current=page]:border-dark aria-[current=page]:bg-dark aria-[current=page]:text-white";

const when = (date: Date | null | undefined) => (date ? `${formatMoscowDateTime(date)} МСК` : "—");

function Card({ id, title, children, aside }: { id: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-[var(--radius-card)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={id} className="text-[1.0625rem] font-medium text-ink">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Dl({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2 text-[0.9375rem]">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 text-right break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StateBadge({ state, text }: { state: "ok" | "error" | "off"; text: string }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "error" ? CircleAlert : CircleDashed;
  const tone = state === "ok" ? "text-ink" : state === "error" ? "text-danger" : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.875rem] font-medium ${tone}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      {text}
    </span>
  );
}

function channelState(enabled: boolean, statuses: Record<string, StatusRow>, channel: string): { state: "ok" | "error" | "off"; text: string } {
  if (!enabled) return { state: "off", text: "Не настроен" };
  const check = statuses[`${channel}:check`];
  const send = statuses[`${channel}:send_message`];
  const latestError = [check, send, statuses[`${channel}:process_event`]].find((s) => s?.lastErrorAt && (!s.lastOkAt || s.lastErrorAt > s.lastOkAt));
  return latestError ? { state: "error", text: "Есть ошибки" } : { state: "ok", text: "Работает" };
}

function ChannelCard({ channel, title, enabled, health, statuses }: { channel: "max" | "telegram"; title: string; enabled: boolean; health: ChannelHealth; statuses: Record<string, StatusRow> }) {
  const s = (op: string) => statuses[`${channel}:${op}`];
  const state = channelState(enabled, statuses, channel);
  const check = s("check");
  const lastProblem = [s("check"), s("webhook"), s("process_event"), s("send_message")]
    .filter((x): x is StatusRow => Boolean(x?.lastErrorAt))
    .sort((a, b) => b.lastErrorAt!.getTime() - a.lastErrorAt!.getTime())[0];
  return (
    <Card id={`ch-${channel}`} title={title} aside={<StateBadge {...state} />}>
      <Dl
        rows={[
          ["Последнее событие (Webhook)", when(health.lastEventAt)],
          ["Последняя успешная обработка", when(s("process_event")?.lastOkAt)],
          ["Последняя успешная отправка", when(s("send_message")?.lastOkAt)],
          ["Проверка подключения", check?.lastOkAt && (!check.lastErrorAt || check.lastOkAt > check.lastErrorAt) ? `успешно, ${when(check.lastOkAt)}` : check?.lastErrorAt ? `ошибка, ${when(check.lastErrorAt)}` : "ещё не выполнялась"],
          ["Ошибки за период", health.errors],
          ["Неотправленные сообщения", `${health.failedSends} (результат неизвестен: ${health.unknownSends})`],
          ["В очереди на отправку", health.pendingSends],
          ["События: повторяются / не обработаны", `${health.retryingEvents} / ${health.failedEvents}`],
          ["Повторные доставки (дубли отсечены)", health.duplicates],
        ]}
      />
      {lastProblem ? (
        <p className="mt-3 rounded-[var(--radius-control)] bg-mist px-3 py-2 text-[0.8125rem] break-words text-ink">
          Последняя ошибка ({when(lastProblem.lastErrorAt)}): {lastProblem.lastError}
        </p>
      ) : null}
    </Card>
  );
}

function backupState(runs: BackupRun[], scheduled: boolean): { state: "ok" | "error" | "off"; text: string } {
  const last = runs[0];
  if (!last) return { state: scheduled ? "error" : "off", text: scheduled ? "Копий ещё нет" : "Не настроено" };
  if (last.status === "failed") return { state: "error", text: "Последняя копия не создана" };
  if (last.status === "running") return { state: "off", text: "Создаётся…" };
  const ageHours = (Date.now() - last.startedAt.getTime()) / 3_600_000;
  return ageHours > 30 && scheduled ? { state: "error", text: "Копия устарела" } : { state: "ok", text: "В порядке" };
}

export default async function SystemPage({ searchParams }: Props) {
  await requireAdminPage();
  const params = await searchParams;
  const period = periods.find((p) => p.value === params.period)?.value ?? "7";
  const days = Number(period);
  const backup = getBackupConfig();
  const maxOn = isMaxEnabled(getMaxConfig());
  const tgOn = isTelegramEnabled(getTelegramConfig());

  let data: {
    statuses: Record<string, StatusRow>;
    max: ChannelHealth;
    telegram: ChannelHealth;
    notifications: NotificationHealth;
    failed: FailedOperation[];
    runs: BackupRun[];
    retention: RetentionSettings;
  } | null = null;
  try {
    const [statuses, max, telegram, notifications, failed, runs, retention] = await Promise.all([
      getIntegrationStatuses(),
      getChannelHealth("max", days),
      getChannelHealth("telegram", days),
      getNotificationHealth(days),
      listFailedOperations(),
      listBackupRuns(),
      getRetentionSettings(),
    ]);
    data = { statuses, max, telegram, notifications, failed, runs, retention };
  } catch (error) {
    console.error("[admin] system page failed:", describeDbError(error));
  }

  if (!data) {
    return (
      <div className="container-page mt-10">
        <div role="alert" className="rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6">
          <h1 className="text-[1.25rem]">База данных недоступна</h1>
          <p className="mt-2 text-muted">Проверьте DATABASE_URL и состояние базы в панели Timeweb.</p>
        </div>
      </div>
    );
  }

  const { statuses, notifications, failed, runs, retention } = data;
  const bState = backupState(runs, isScheduledBackupEnabled(backup));

  return (
    <div className="container-page mt-8 lg:mt-10">
      <AutoRefresh intervalMs={60_000} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[2rem] leading-tight">Система и интеграции</h1>
          <p className="mt-2 max-w-2xl text-muted">Данные из базы сайта; к API мессенджеров страница не обращается. Подключение проверяется в фоне раз в 30 минут.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CheckNow />
          <Link href="/admin/sistema/zhurnal" className={buttonClass("outline", "min-h-10 bg-white px-4")}>
            <ListChecks aria-hidden="true" className="h-4 w-4" />
            Журнал ошибок
          </Link>
        </div>
      </div>

      <nav aria-label="Период" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <li key={p.value}>
              <Link href={`/admin/sistema?period=${p.value}`} aria-current={period === p.value ? "page" : undefined} className={chip}>
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChannelCard channel="telegram" title="Telegram" enabled={tgOn} health={data.telegram} statuses={statuses} />
        <ChannelCard channel="max" title="MAX" enabled={maxOn} health={data.max} statuses={statuses} />

        <Card
          id="notif"
          title="Уведомления сотрудникам"
          aside={<StateBadge state={notifications.failed ? "error" : "ok"} text={notifications.failed ? "Есть недоставленные" : "В порядке"} />}
        >
          <Dl
            rows={[
              ["Push: настроен на сервере", getPushConfig() ? "да" : "нет (VAPID_*)"],
              ["Push: подключено устройств", notifications.pushSubscriptions],
              ["Telegram: получателей", notifications.telegramRecipients],
              ["Доставлено за период", notifications.sent],
              ["В очереди", notifications.pending],
              ["Не доставлено за период", notifications.failed],
              ["Последняя доставка push", when(statuses["push:notify"]?.lastOkAt)],
              ["Последняя доставка в Telegram", when(statuses["telegram_admin:notify"]?.lastOkAt)],
            ]}
          />
          <Link href="/admin/uvedomleniya/nastroyki" className="mt-3 inline-block text-[0.875rem] text-link">
            Настройки уведомлений
          </Link>
        </Card>

        <Card id="backup" title="Резервные копии" aside={<StateBadge {...bState} />}>
          <Dl
            rows={[
              ["Ключ шифрования", backup.key ? "задан" : "не задан"],
              ["Внешнее хранилище", backup.s3 ? `${backup.s3.endpoint} / ${backup.s3.bucket}` : "не настроено"],
              ["Расписание", isScheduledBackupEnabled(backup) ? `ежедневно в ${backup.hourMsk}:00 МСК, хранить ${backup.retentionDays} дн.` : "выключено"],
              ["Последняя успешная", when(runs.find((r) => r.status === "ok")?.startedAt)],
            ]}
          />
          {backup.problems.length ? <p className="mt-2 text-[0.8125rem] text-danger">{backup.problems.join(" ")}</p> : null}
          <div className="mt-4">
            <BackupButtons s3Ready={Boolean(backup.s3)} keyReady={Boolean(backup.key)} />
          </div>
          {runs.length ? (
            <ul className="mt-4 divide-y divide-line border-t border-line text-[0.8125rem]" aria-label="Последние запуски">
              {runs.slice(0, 5).map((run) => (
                <li key={run.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="text-ink">
                    {when(run.startedAt)} · {run.trigger === "schedule" ? "по расписанию" : "вручную"}
                  </span>
                  <span className={run.status === "failed" ? "text-danger" : "text-muted"}>
                    {run.status === "ok"
                      ? `${Math.round((run.sizeBytes ?? 0) / 1024)} КБ, строк ${run.rowCount}${run.location ? `, ${run.location}` : ""}`
                      : run.status === "failed"
                        ? `ошибка: ${run.error}`
                        : "создаётся"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <section aria-labelledby="failed" className="mt-4 rounded-[var(--radius-card)] bg-white p-5">
        <h2 id="failed" className="text-[1.0625rem] font-medium text-ink">
          Неуспешные операции
        </h2>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Повторить можно обработку событий (она транзакционна и не создаёт дублей) и доставку уведомлений. Неотправленные
          ответы клиентам повторяются из карточки диалога.
        </p>
        {failed.length === 0 ? (
          <p className="mt-3 text-[0.9375rem] text-muted">Неуспешных операций нет.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {failed.map((op) => (
              <li key={`${op.kind}-${op.id}`} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <span className="min-w-0 text-[0.9375rem]">
                  <span className="text-ink">{op.title}</span>
                  <span className="ml-2 text-[0.8125rem] text-muted">
                    {monitorChannelLabels[op.channel as keyof typeof monitorChannelLabels] ?? op.channel} · {when(op.at)}
                  </span>
                  {op.error ? <span className="block text-[0.8125rem] break-words text-danger">{op.error}</span> : null}
                </span>
                <RetryOperation kind={op.kind} id={op.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="retention" className="mt-4 rounded-[var(--radius-card)] bg-white p-5">
        <h2 id="retention" className="text-[1.0625rem] font-medium text-ink">
          Сроки хранения
        </h2>
        <p className="mt-1 mb-4 text-[0.8125rem] text-muted">
          Служебные записи удаляются автоматически: уведомления — через 90 дней, журнал — через 180, история копий — через
          год. Персональные данные удаляются автоматически только если срок задан здесь (решение оператора персональных
          данных, см. политику). Пусто — не удалять.
        </p>
        <RetentionForm chatDays={retention.chatDays} requestDays={retention.requestDays} />
      </section>
    </div>
  );
}
