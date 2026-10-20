import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError, query } from "@/lib/db";
import { getPushConfig } from "@/lib/notifications/config";
import { listRecipients, type Recipient } from "@/lib/notifications/telegram-link";
import { formatMoscowDateTime } from "@/lib/requests/csv";
import { defaultNotificationSettings, getNotificationSettings, notificationTypes, type NotificationSettings } from "@/lib/ops/settings";
import { getTelegramConfig, isTelegramEnabled } from "@/lib/telegram/config";
import { PushToggle } from "@/components/admin/notifications/PushToggle";
import { NotificationSettingsForm, RemoveRecipient, TelegramLink, TestNotification } from "@/components/admin/notifications/SettingsForms";

export const metadata: Metadata = { title: "Настройки уведомлений" };

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-4 rounded-[var(--radius-card)] bg-white p-5 sm:p-6">
      <h2 id={id} className="text-[1.125rem] font-medium text-ink">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function NotificationSettingsPage() {
  await requireAdminPage();
  const push = getPushConfig();
  let settings: NotificationSettings = defaultNotificationSettings;
  let recipients: Recipient[] = [];
  let subscriptions = 0;
  try {
    [settings, recipients] = await Promise.all([getNotificationSettings(), listRecipients()]);
    subscriptions = Number((await query<{ count: string }>("SELECT count(*) AS count FROM push_subscriptions"))[0]?.count ?? 0);
  } catch (error) {
    console.error("[admin] notification settings load failed:", describeDbError(error));
  }
  const telegramReady = isTelegramEnabled(getTelegramConfig());

  return (
    <div className="container-page mt-8 max-w-3xl lg:mt-10">
      <Link href="/admin/uvedomleniya" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Уведомления
      </Link>
      <h1 className="mt-5 text-[2rem] leading-tight">Настройки уведомлений</h1>
      <p className="mt-2 text-muted">
        Все события видны в центре уведомлений админки. Дополнительно их можно получать push-уведомлениями браузера и
        сообщениями в Telegram. В push и Telegram не передаются имена, телефоны и тексты клиентов — только тип события и
        ссылка в админку.
      </p>

      <Card id="push" title="Push-уведомления в браузере">
        <p className="mb-3 text-[0.875rem] text-muted">
          Включаются отдельно на каждом устройстве и в каждом браузере. Приходят и при закрытой вкладке, если это
          поддерживают браузер и система; доставка не гарантирована. Подключено устройств: {subscriptions}.
        </p>
        <PushToggle publicKey={push?.publicKey ?? null} />
      </Card>

      <Card id="telegram" title="Уведомления в Telegram">
        <p className="mb-3 text-[0.875rem] text-muted">
          Приходят от бота компании. Подключить можно только по одноразовой ссылке, созданной здесь: посторонний человек,
          написавший боту, уведомлений не получит.
        </p>
        <TelegramLink disabledReason={telegramReady ? null : "Telegram-бот не настроен на сервере (см. «Настройки каналов»)."} />
        {recipients.length ? (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {recipients.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[0.9375rem]">
                <span className="text-ink">
                  {r.displayName || `Чат ${r.chatId}`}
                  <span className="ml-2 text-[0.8125rem] text-muted">
                    {r.active ? "подключён" : "отключён (заблокировал бота)"} с {formatMoscowDateTime(r.createdAt)}
                  </span>
                </span>
                <RemoveRecipient id={r.id} />
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card id="types" title="Какие события присылать">
        <NotificationSettingsForm
          types={notificationTypes.map((t) => ({ value: t.value, label: t.label }))}
          selected={settings.transports}
          throttle={settings.messageThrottleMinutes}
        />
      </Card>

      <Card id="test" title="Проверка">
        <TestNotification />
      </Card>
    </div>
  );
}
