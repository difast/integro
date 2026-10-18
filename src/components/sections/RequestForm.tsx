"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { submitRequest } from "@/app/(site)/kontakty/actions";
import { initialRequestState, limits, type RequestFieldName } from "@/lib/request-form";
import { company } from "@/config/company";
import { legalDocuments } from "@/config/legal";
import { ConsentBody } from "@/content/legal/consent";
import { buttonClass } from "@/components/ui/Button";

type ServiceOption = { value: string; label: string };

type RequestFormProps = {
  services: ServiceOption[];
  defaultService?: string;
  /** false — не настроены ни база заявок, ни SMTP: форма показывается, но отправка отключена */
  enabled: boolean;
  /** Показывать подсказку для владельца сайта (только вне production) */
  showSetupHint?: boolean;
  /** Опубликованы ли на сайте телефон, почта или адрес */
  hasContacts?: boolean;
};

const inputClass =
  "mt-2 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-4 py-3 text-base text-ink placeholder:text-muted/70 transition-colors focus:border-dark focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-dark aria-[invalid=true]:border-danger disabled:bg-mist disabled:text-muted";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-[0.875rem] font-medium text-danger">
      {message}
    </p>
  );
}

function newSubmissionKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Запасной вариант для старых браузеров: UUID v4 из криптографического генератора.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function RequestForm({
  services,
  defaultService = "",
  enabled,
  showSetupHint = false,
  hasContacts = false,
}: RequestFormProps) {
  const [state, formAction, pending] = useActionState(submitRequest, initialRequestState);
  const startedAtRef = useRef(0);
  const submissionKeyRef = useRef("");
  const statusRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Время открытия формы — для серверной проверки от автоматической отправки.
  // Хранится вне DOM: React сбрасывает поля формы после каждого действия.
  // Ключ отправки защищает от дубликатов при двойном нажатии и повторе после сбоя:
  // он одинаков для всех попыток одной заявки и меняется после успешной отправки.
  useEffect(() => {
    startedAtRef.current = Date.now();
    submissionKeyRef.current = newSubmissionKey();
  }, []);

  const submit = (formData: FormData) => {
    formData.set("startedAt", String(startedAtRef.current));
    formData.set("submissionKey", submissionKeyRef.current);
    formData.set("page", `${window.location.pathname}${window.location.search}`);
    formAction(formData);
  };

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      submissionKeyRef.current = newSubmissionKey();
    }
    if (state.status !== "idle") statusRef.current?.focus();
  }, [state]);

  const errors = state.fieldErrors ?? {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errorProps = (name: RequestFieldName) =>
    errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};

  // Ключ пересоздаёт поля после ответа сервера, чтобы восстановить введённые значения.
  const fieldsKey = `${state.status}-${JSON.stringify(values)}`;

  return (
    <form ref={formRef} action={submit} noValidate className="space-y-6" aria-describedby="form-status">
      <div ref={statusRef} id="form-status" tabIndex={-1} aria-live="polite" className="outline-none">
        {!enabled ? (
          <div className="flex gap-3 rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-mist p-4 text-[0.9375rem] leading-relaxed text-ink">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Приём заявок через сайт пока не подключён.</p>
              {showSetupHint ? (
                <p className="mt-1">
                  Для владельца сайта: задайте переменную DATABASE_URL (база заявок) и при необходимости SMTP_HOST,
                  SMTP_USER, SMTP_PASSWORD и MAIL_TO для уведомлений (см. .env.example). Это сообщение видно только в
                  режиме разработки.
                </p>
              ) : hasContacts ? (
                <p className="mt-1">Пожалуйста, воспользуйтесь контактами, указанными на этой странице.</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {state.status === "success" ? (
          <div className="flex gap-3 rounded-[var(--radius-control)] border-l-[3px] border-dark bg-mist p-4 text-ink">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="font-medium">{state.message}</p>
          </div>
        ) : null}
        {state.status === "error" && state.message ? (
          <div role="alert" className="flex gap-3 rounded-[var(--radius-control)] border-l-[3px] border-danger bg-mist p-4 text-ink">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <p className="font-medium">{state.message}</p>
          </div>
        ) : null}
      </div>

      <fieldset key={fieldsKey} disabled={!enabled || pending} className="space-y-6">
        <legend className="sr-only">Данные для обращения</legend>

        <div>
          <label htmlFor="name" className="text-[0.9375rem] font-medium text-ink">
            Как к вам обращаться <span className="text-bronze-deep" aria-hidden="true">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={limits.name}
            defaultValue={values.name}
            className={inputClass}
            {...errorProps("name")}
          />
          <FieldError id="name-error" message={errors.name} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="text-[0.9375rem] font-medium text-ink">
              Телефон
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={limits.phone}
              placeholder="+7"
              defaultValue={values.phone}
              className={inputClass}
              {...errorProps("phone")}
            />
            <FieldError id="phone-error" message={errors.phone} />
          </div>
          <div>
            <label htmlFor="email" className="text-[0.9375rem] font-medium text-ink">
              Электронная почта
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={limits.email}
              defaultValue={values.email}
              className={inputClass}
              {...errorProps("email")}
            />
            <FieldError id="email-error" message={errors.email} />
          </div>
        </div>
        <p className="-mt-3 text-[0.875rem] text-muted">Укажите хотя бы один способ связи.</p>

        <div>
          <label htmlFor="service" className="text-[0.9375rem] font-medium text-ink">
            Направление
          </label>
          <div className="relative">
            <select
              id="service"
              name="service"
              defaultValue={values.service ?? defaultService}
              className={`${inputClass} appearance-none pr-12`}
              {...errorProps("service")}
            >
              <option value="">Не знаю / нужна консультация</option>
              {services.map((service) => (
                <option key={service.value} value={service.value}>
                  {service.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-4 mt-1 h-4 w-4 -translate-y-1/2 text-muted"
            />
          </div>
          <FieldError id="service-error" message={errors.service} />
        </div>

        <div>
          <label htmlFor="message" className="text-[0.9375rem] font-medium text-ink">
            Опишите задачу <span className="text-bronze-deep" aria-hidden="true">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            required
            maxLength={limits.message}
            placeholder="Объект, цель, сроки; для судебной экспертизы — суд и номер дела, если известны"
            defaultValue={values.message}
            className={`${inputClass} resize-y`}
            {...errorProps("message")}
          />
          <FieldError id="message-error" message={errors.message} />
        </div>

        {/* Ловушка для ботов: поле скрыто от пользователей и вспомогательных технологий. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Не заполняйте это поле</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <p className="text-[0.875rem] leading-relaxed text-muted">
          Не указывайте в заявке паспортные данные, сведения о здоровье и персональные данные третьих лиц — они не
          нужны для предварительного анализа задачи.
        </p>

        {/* Согласие оформлено отдельно: одно поле, без предварительной отметки и без иных подтверждений. */}
        <div className="border-t border-line pt-6">
          <div className="flex gap-3">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              required
              className="mt-0.5 h-5 w-5 shrink-0 rounded-none accent-[var(--color-dark)]"
              {...errorProps("consent")}
            />
            <label htmlFor="consent" className="text-[0.9375rem] leading-relaxed text-ink">
              Даю согласие {company.legalName} на обработку моих персональных данных на условиях, изложенных в тексте
              согласия ниже. <span className="text-bronze-deep" aria-hidden="true">*</span>
            </label>
          </div>
          <FieldError id="consent-error" message={errors.consent} />

          <details className="group mt-4 ml-8 border-l-2 border-line pl-4">
            <summary className="cursor-pointer list-none text-[0.875rem] font-medium text-ink underline decoration-bronze underline-offset-4 hover:text-bronze-deep [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Показать текст согласия</span>
              <span className="hidden group-open:inline">Скрыть текст согласия</span>
            </summary>
            <div className="mt-4 max-h-80 overflow-y-auto pr-2 text-[0.875rem] leading-relaxed text-body">
              <ConsentBody />
              <p className="mt-4">
                <Link href={legalDocuments.consent.href} className="text-link" target="_blank">
                  Открыть согласие на отдельной странице
                </Link>
              </p>
            </div>
          </details>

          <p className="mt-5 text-[0.8125rem] leading-relaxed text-muted">
            Порядок обработки персональных данных описан в{" "}
            <Link href={legalDocuments.policy.href} className="text-link" target="_blank">
              политике обработки персональных данных
            </Link>
            .
          </p>
        </div>

        <button type="submit" className={buttonClass("primary", "w-full sm:w-auto")}>
          {pending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          )}
          {pending ? "Отправляем…" : "Отправить заявку"}
        </button>
      </fieldset>
    </form>
  );
}
