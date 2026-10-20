import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert } from "lucide-react";
import { company } from "@/config/company";
import { requireAdminPage } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { maxUpdateTypes } from "@/lib/max/api";
import { getMaxConfig, maxProblemText, MAX_WEBHOOK_PATH } from "@/lib/max/config";
import { telegramAllowedUpdates } from "@/lib/telegram/api";
import { getTelegramConfig, telegramProblemText, TELEGRAM_WEBHOOK_PATH } from "@/lib/telegram/config";
import { SetupActions } from "@/components/admin/chat/SetupActions";
import { checkMax, checkTelegram, registerMax, registerTelegram, removeMax, removeTelegram } from "../actions";

export const metadata: Metadata = { title: "Настройки каналов" };

function Row({ ok, label, hint, invalid = false, optional = false }: { ok: boolean; label: string; hint?: string; invalid?: boolean; optional?: boolean }) {
  return (
    <li className="flex gap-3 py-3">
      {ok ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
      ) : (
        <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${optional && !invalid ? "text-muted" : "text-danger"}`} />
      )}
      <span>
        <span className="block text-[0.9375rem] text-ink">
          {label} — <span className="font-medium">{ok ? "задано" : invalid ? "задано с ошибкой" : "не задано"}</span>
        </span>
        {hint ? <span className="mt-0.5 block text-[0.8125rem] break-words text-muted">{hint}</span> : null}
      </span>
    </li>
  );
}

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-4 rounded-[var(--radius-card)] bg-white p-6">
      <h2 id={id} className="text-[1.125rem] font-medium text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AdminChannelSettingsPage() {
  await requireAdminPage();
  const max = getMaxConfig();
  const tg = getTelegramConfig();
  const hasMax = (p: string) => max.problems.includes(p as never);
  const hasTg = (p: string) => tg.problems.includes(p as never);
  const maxLink = company.contacts.messengers.max.href;
  const tgLink = tg.username ? `https://t.me/${tg.username}` : null;

  return (
    <div className="container-page mt-8 max-w-3xl lg:mt-10">
      <Link href="/admin/obrashcheniya" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Обращения
      </Link>
      <h1 className="mt-5 text-[2rem] leading-tight">Настройки каналов</h1>
      <p className="mt-2 text-muted">
        Токены и секреты не показываются и не хранятся в базе — они задаются только в переменных окружения приложения в
        панели Timeweb. После изменения переменных приложение нужно перезапустить.
      </p>
      <ul className="mt-4 rounded-[var(--radius-card)] bg-white px-6">
        <Row ok={isDatabaseConfigured()} label="DATABASE_URL" hint="Обращения и переписка всех каналов хранятся в базе сайта." />
      </ul>

      <Card id="telegram" title="Telegram">
        <ul className="mt-2 divide-y divide-line">
          <Row ok={!hasTg("token_missing") && !hasTg("token_invalid")} invalid={hasTg("token_invalid")} label="TELEGRAM_BOT_TOKEN" hint={hasTg("token_invalid") ? telegramProblemText.token_invalid : "Токен бота — выдаёт @BotFather."} />
          <Row
            ok={!hasTg("secret_missing") && !hasTg("secret_invalid")}
            invalid={hasTg("secret_invalid")}
            label="TELEGRAM_WEBHOOK_SECRET"
            hint={hasTg("secret_invalid") ? telegramProblemText.secret_invalid : "Случайная строка 32+ символов, например: openssl rand -hex 32."}
          />
          <Row
            ok={Boolean(tg.webhookUrl)}
            invalid={hasTg("webhook_url_invalid")}
            label="Адрес Webhook (TELEGRAM_WEBHOOK_URL или SITE_URL)"
            hint={tg.webhookUrl ?? (hasTg("webhook_url_invalid") ? telegramProblemText.webhook_url_invalid : telegramProblemText.webhook_url_missing)}
          />
          <Row ok={Boolean(tg.username)} optional invalid={hasTg("username_invalid")} label="TELEGRAM_BOT_USERNAME (необязательно)" hint={hasTg("username_invalid") ? telegramProblemText.username_invalid : "Username бота без «@» — для ссылки на бота."} />
        </ul>
        {hasTg("api_base_invalid") ? <p className="mt-3 text-[0.875rem] text-danger">{telegramProblemText.api_base_invalid}</p> : null}
        <p className="mt-4 mb-5 text-[0.875rem] text-muted">
          Регистрация вызывает setWebhook с адресом <span className="break-all text-ink">{tg.webhookUrl ?? `…${TELEGRAM_WEBHOOK_PATH}`}</span>,
          секретом и событиями: {telegramAllowedUpdates.join(", ")}. Повторная регистрация безопасна.
        </p>
        <SetupActions
          check={checkTelegram}
          register={registerTelegram}
          remove={removeTelegram}
          canCheck={!hasTg("token_missing") && !hasTg("token_invalid")}
          canRegister={tg.problems.filter((p) => p !== "username_invalid").length === 0}
          removeLabel="Удалить Webhook Telegram"
        />
        <ol className="mt-6 list-decimal space-y-1.5 pl-5 text-[0.9375rem] text-ink">
          <li>«Проверить подключение» — должны отобразиться имя и username бота.</li>
          <li>«Зарегистрировать Webhook», затем снова «Проверить подключение» — адрес сайта и пустая очередь.</li>
          <li>
            Отправьте боту /start
            {tgLink ? (
              <>
                {" "}
                (<a href={tgLink} target="_blank" rel="noopener noreferrer" className="text-link break-all">{tgLink}</a>)
              </>
            ) : null}{" "}
            — в «Обращениях» появится карточка.
          </li>
        </ol>
      </Card>

      <Card id="max" title="MAX">
        <ul className="mt-2 divide-y divide-line">
          <Row ok={!hasMax("token_missing")} label="MAX_BOT_TOKEN" hint="Токен бота — выдаёт @MasterBot в MAX." />
          <Row
            ok={!hasMax("secret_missing") && !hasMax("secret_invalid")}
            invalid={hasMax("secret_invalid")}
            label="MAX_WEBHOOK_SECRET"
            hint={hasMax("secret_invalid") ? maxProblemText.secret_invalid : "Случайная строка 32+ символов, например: openssl rand -hex 32."}
          />
          <Row
            ok={Boolean(max.webhookUrl)}
            invalid={hasMax("webhook_url_invalid")}
            label="Адрес Webhook (MAX_WEBHOOK_URL или SITE_URL)"
            hint={max.webhookUrl ?? (hasMax("webhook_url_invalid") ? maxProblemText.webhook_url_invalid : maxProblemText.webhook_url_missing)}
          />
          <Row ok={Boolean(max.caCert)} optional label="MAX_API_CA_CERT (необязательно)" hint="Нужен, только если проверка подключения сообщает об ошибке сертификата." />
        </ul>
        {hasMax("api_base_invalid") ? <p className="mt-3 text-[0.875rem] text-danger">{maxProblemText.api_base_invalid}</p> : null}
        <p className="mt-4 mb-5 text-[0.875rem] text-muted">
          Регистрация отправляет в MAX адрес <span className="break-all text-ink">{max.webhookUrl ?? `…${MAX_WEBHOOK_PATH}`}</span>, секрет и
          список событий: {maxUpdateTypes.join(", ")}. Повторная регистрация того же адреса безопасна.
        </p>
        <SetupActions
          check={checkMax}
          register={registerMax}
          remove={removeMax}
          canCheck={!hasMax("token_missing")}
          canRegister={max.problems.length === 0}
          removeLabel="Удалить подписку MAX этого сайта"
        />
        <ol className="mt-6 list-decimal space-y-1.5 pl-5 text-[0.9375rem] text-ink">
          <li>«Проверить подключение» — должны отобразиться имя и id бота.</li>
          <li>«Зарегистрировать Webhook», затем снова «Проверить подключение» — в подписках появится адрес сайта.</li>
          <li>
            Напишите боту в MAX
            {maxLink ? (
              <>
                {" "}
                (<a href={maxLink} target="_blank" rel="noopener noreferrer" className="text-link break-all">{maxLink}</a>)
              </>
            ) : null}{" "}
            — в «Обращениях» появится карточка.
          </li>
        </ol>
      </Card>
    </div>
  );
}
