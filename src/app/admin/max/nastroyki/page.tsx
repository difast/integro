import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert } from "lucide-react";
import { company } from "@/config/company";
import { requireAdminPage } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { maxUpdateTypes } from "@/lib/max/api";
import { getMaxConfig, maxProblemText, MAX_WEBHOOK_PATH } from "@/lib/max/config";
import { SetupActions } from "@/components/admin/max/SetupActions";

export const metadata: Metadata = { title: "Настройки MAX" };

function Row({ ok, label, hint, invalid = false }: { ok: boolean; label: string; hint?: string; invalid?: boolean }) {
  return (
    <li className="flex gap-3 py-3">
      {ok ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
      ) : (
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
      )}
      <span>
        <span className="block text-[0.9375rem] text-ink">
          {label} — <span className="font-medium">{ok ? "задано" : invalid ? "задано с ошибкой" : "не задано"}</span>
        </span>
        {hint ? <span className="mt-0.5 block text-[0.8125rem] text-muted">{hint}</span> : null}
      </span>
    </li>
  );
}

export default async function AdminMaxSettingsPage() {
  await requireAdminPage();
  const config = getMaxConfig();
  const has = (p: string) => config.problems.includes(p as never);
  const botLink = company.contacts.messengers.max.href;

  return (
    <div className="container-page mt-8 max-w-3xl lg:mt-10">
      <Link href="/admin/max" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Обращения MAX
      </Link>
      <h1 className="mt-5 text-[2rem] leading-tight">Настройки MAX</h1>
      <p className="mt-2 text-muted">
        Значения токена и секрета не показываются и не хранятся в базе — они задаются только в переменных окружения
        приложения в панели Timeweb.
      </p>

      <section aria-labelledby="env" className="mt-8 rounded-[var(--radius-card)] bg-white p-6">
        <h2 id="env" className="text-[0.875rem] font-medium text-muted">
          Переменные окружения
        </h2>
        <ul className="mt-2 divide-y divide-line">
          <Row ok={!has("token_missing")} label="MAX_BOT_TOKEN" hint="Токен бота — выдаёт @MasterBot в MAX." />
          <Row
            ok={!has("secret_missing") && !has("secret_invalid")}
            invalid={has("secret_invalid")}
            label="MAX_WEBHOOK_SECRET"
            hint={has("secret_invalid") ? maxProblemText.secret_invalid : "Случайная строка 32+ символов, например: openssl rand -hex 32."}
          />
          <Row
            ok={Boolean(config.webhookUrl)}
            label="Адрес Webhook (MAX_WEBHOOK_URL или SITE_URL)"
            hint={config.webhookUrl ?? (has("webhook_url_invalid") ? maxProblemText.webhook_url_invalid : maxProblemText.webhook_url_missing)}
          />
          <Row ok={isDatabaseConfigured()} label="DATABASE_URL" hint="Обращения и переписка хранятся в базе сайта." />
          <Row ok={Boolean(config.caCert)} label="MAX_API_CA_CERT (необязательно)" hint="Нужен, только если проверка подключения сообщает об ошибке сертификата." />
        </ul>
        {has("api_base_invalid") ? <p className="mt-3 text-[0.875rem] text-danger">{maxProblemText.api_base_invalid}</p> : null}
      </section>

      <section aria-labelledby="actions" className="mt-4 rounded-[var(--radius-card)] bg-white p-6">
        <h2 id="actions" className="text-[0.875rem] font-medium text-muted">
          Подключение
        </h2>
        <p className="mt-2 mb-5 text-[0.875rem] text-muted">
          Регистрация отправляет в MAX адрес <span className="break-all text-ink">{config.webhookUrl ?? `…${MAX_WEBHOOK_PATH}`}</span>, секрет и
          список событий: {maxUpdateTypes.join(", ")}. Повторная регистрация того же адреса безопасна.
        </p>
        <SetupActions canCheck={!has("token_missing")} canRegister={config.problems.length === 0} />
      </section>

      <section aria-labelledby="howto" className="mt-4 rounded-[var(--radius-card)] bg-white p-6">
        <h2 id="howto" className="text-[0.875rem] font-medium text-muted">
          Порядок проверки
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[0.9375rem] text-ink">
          <li>Задайте переменные в Timeweb и перезапустите приложение.</li>
          <li>Нажмите «Проверить подключение» — должны отобразиться имя и id бота.</li>
          <li>Нажмите «Зарегистрировать Webhook», затем снова «Проверить подключение» — в подписках появится адрес сайта.</li>
          <li>
            Напишите боту в MAX{botLink ? (
              <>
                {" "}
                (<a href={botLink} target="_blank" rel="noopener noreferrer" className="text-link break-all">{botLink}</a>)
              </>
            ) : null}{" "}
            — в разделе «MAX — обращения» появится карточка с сообщениями.
          </li>
          <li>Откройте карточку и отправьте ответ — он должен прийти в MAX.</li>
        </ol>
      </section>
    </div>
  );
}
