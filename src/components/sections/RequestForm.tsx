"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Send } from "lucide-react";
import { submitRequest } from "@/app/kontakty/actions";
import { initialRequestState, limits, type RequestFieldName } from "@/lib/request-form";
import { buttonClass } from "@/components/ui/Button";

type ServiceOption = { value: string; label: string };

type RequestFormProps = {
  services: ServiceOption[];
  defaultService?: string;
  /** false — SMTP не настроен: форма показывается, но отправка отключена */
  enabled: boolean;
  /** Показывать подсказку для владельца сайта (только вне production) */
  showSetupHint?: boolean;
  /** Опубликованы ли на сайте телефон, почта или адрес */
  hasContacts?: boolean;
};

const inputClass =
  "mt-2 block w-full rounded-xl border border-line bg-white px-4 py-3.5 text-base text-ink placeholder:text-muted/70 transition-colors focus:border-navy-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-navy-700 aria-[invalid=true]:border-accent disabled:bg-paper";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-sm font-semibold text-accent">
      {message}
    </p>
  );
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
  const statusRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Время открытия формы — для серверной проверки от автоматической отправки.
  // Хранится вне DOM: React сбрасывает поля формы после каждого действия.
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const submit = (formData: FormData) => {
    formData.set("startedAt", String(startedAtRef.current));
    formAction(formData);
  };

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
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
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Приём заявок через сайт пока не подключён.</p>
              {showSetupHint ? (
                <p className="mt-1">
                  Для владельца сайта: задайте переменные SMTP_HOST, SMTP_USER, SMTP_PASSWORD и MAIL_TO (см.
                  .env.example). Это сообщение видно только в режиме разработки.
                </p>
              ) : hasContacts ? (
                <p className="mt-1">Пожалуйста, воспользуйтесь контактами, указанными на этой странице.</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {state.status === "success" ? (
          <div className="flex gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="font-semibold">{state.message}</p>
          </div>
        ) : null}
        {state.status === "error" && state.message ? (
          <div role="alert" className="flex gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4 text-ink">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <p className="font-semibold">{state.message}</p>
          </div>
        ) : null}
      </div>

      <fieldset key={fieldsKey} disabled={!enabled || pending} className="space-y-6">
        <legend className="sr-only">Данные для обращения</legend>

        <div>
          <label htmlFor="name" className="font-bold text-ink">
            Как к вам обращаться <span className="text-accent" aria-hidden="true">*</span>
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
            <label htmlFor="phone" className="font-bold text-ink">
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
            <label htmlFor="email" className="font-bold text-ink">
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
        <p className="-mt-3 text-sm text-muted">Укажите хотя бы один способ связи.</p>

        <div>
          <label htmlFor="service" className="font-bold text-ink">
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
              className="pointer-events-none absolute top-1/2 right-4 mt-1 h-5 w-5 -translate-y-1/2 text-muted"
            />
          </div>
          <FieldError id="service-error" message={errors.service} />
        </div>

        <div>
          <label htmlFor="message" className="font-bold text-ink">
            Опишите задачу <span className="text-accent" aria-hidden="true">*</span>
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

        <div>
          <div className="flex gap-3">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              required
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
              {...errorProps("consent")}
            />
            <label htmlFor="consent" className="text-sm leading-relaxed text-muted">
              Я даю{" "}
              <Link href="/soglasie-na-obrabotku" className="link-underline text-ink" target="_blank">
                согласие на обработку персональных данных
              </Link>{" "}
              и подтверждаю, что ознакомлен с{" "}
              <Link href="/politika-konfidencialnosti" className="link-underline text-ink" target="_blank">
                политикой обработки персональных данных
              </Link>
              .
            </label>
          </div>
          <FieldError id="consent-error" message={errors.consent} />
        </div>

        <button type="submit" className={buttonClass("primary", "w-full sm:w-auto")}>
          {pending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="h-4 w-4" />
          )}
          {pending ? "Отправляем…" : "Отправить заявку"}
        </button>
      </fieldset>
    </form>
  );
}
