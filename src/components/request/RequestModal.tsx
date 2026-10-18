"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Loader2, X } from "lucide-react";
import { company } from "@/config/company";
import { legalDocuments } from "@/config/legal";
import { limits } from "@/lib/request-form";
import { buttonClass } from "@/components/ui/Button";
import { useRequestForm } from "./useRequestForm";

type ServiceOption = { value: string; label: string };
type OpenOptions = { service?: string; params?: Record<string, string> };

const RequestModalContext = createContext<((options?: OpenOptions) => void) | null>(null);

/**
 * Всплывающая форма заявки. Окно — нативный <dialog>: фокус остаётся внутри,
 * Esc закрывает окно. Разметка компактная, чтобы окно целиком помещалось в экран
 * телефона без прокрутки. Заявка уходит в то же серверное действие, что и форма
 * на странице «Контакты».
 */
export function RequestModalProvider({
  services,
  serviceMap,
  children,
}: {
  services: ServiceOption[];
  /** slug страницы услуги → направление в форме */
  serviceMap: Record<string, string>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OpenOptions>({});
  // Новый ключ при каждом открытии — чистая форма с новым ключом отправки.
  const [formKey, setFormKey] = useState(0);

  const openRequest = useCallback(
    (next: OpenOptions = {}) => {
      setOptions({ ...next, service: next.service ? (serviceMap[next.service] ?? "") : "" });
      setFormKey((key) => key + 1);
      setOpen(true);
    },
    [serviceMap],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal ставит фокус на первый элемент (кнопку «Закрыть») — переводим его на первое поле.
      requestAnimationFrame(() => dialog.querySelector<HTMLInputElement>("#rq-name")?.focus());
    }
    if (!open && dialog.open) dialog.close();
    // Фон страницы не прокручивается, пока окно открыто.
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <RequestModalContext.Provider value={openRequest}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="rq-title"
        onClose={close}
        onClick={(event) => {
          // Клик по затемнённому фону закрывает окно.
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto w-[min(34rem,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[var(--radius-panel)] bg-white p-0 text-body shadow-[0_30px_80px_-30px_rgba(29,43,55,0.6)] backdrop:bg-dark-950/60"
      >
        {open ? (
          <RequestDialogForm
            key={formKey}
            services={services}
            defaultService={options.service ?? ""}
            pageParams={{ ...options.params, forma: "okno" }}
            onClose={close}
          />
        ) : null}
      </dialog>
    </RequestModalContext.Provider>
  );
}

const inputClass =
  "mt-1 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-1.5 text-base leading-6 text-ink placeholder:text-muted/70 transition-colors focus:border-dark focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-dark aria-[invalid=true]:border-danger disabled:bg-mist";
const labelClass = "text-[0.8125rem] leading-5 font-medium text-ink";

// Короткие формулировки для окна — чтобы оно помещалось в экран даже при всех ошибках сразу.
const shortMessages: Record<string, string> = {
  "Укажите телефон или электронную почту для ответа": "Укажите телефон или почту",
  "Необходимо согласие на обработку персональных данных": "Нужно согласие на обработку данных",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-0.5 text-[0.8125rem] leading-snug font-medium text-danger">
      {shortMessages[message] ?? message}
    </p>
  );
}

function RequestDialogForm({
  services,
  defaultService,
  pageParams,
  onClose,
}: {
  services: ServiceOption[];
  defaultService: string;
  pageParams: Record<string, string>;
  onClose: () => void;
}) {
  const p = "rq-";
  const { pending, submit, handleSubmit, errors, values, errorProps, statusRef, formRef, fieldsKey, success, errorMessage } =
    useRequestForm({ idPrefix: p, pageParams });
  // Ошибки полей показываются у полей; общая плашка — только для ошибок без привязки к полю.
  const hasFieldErrors = Object.keys(errors).length > 0;
  const contactError = errors.phone ?? errors.email;

  if (success) {
    return (
      <div className="p-6 sm:p-8" ref={statusRef} tabIndex={-1} aria-live="polite">
        <div className="flex items-start justify-between gap-4">
          <h2 id="rq-title" className="text-[1.375rem] leading-tight">
            Заявка отправлена
          </h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="-mt-1 -mr-1 rounded-full p-2 text-muted hover:bg-mist hover:text-ink">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-4 flex gap-3 text-ink">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          Мы свяжемся с вами по указанным контактам после предварительного анализа задачи.
        </p>
        <button type="button" onClick={onClose} className={buttonClass("primary", "mt-6 w-full sm:w-auto")}>
          Закрыть
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={submit} onSubmit={handleSubmit} noValidate className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 id="rq-title" className="pt-1 text-[1.25rem] leading-tight sm:text-[1.375rem]">
          Оставить заявку
        </h2>
        <button type="button" onClick={onClose} aria-label="Закрыть окно заявки" className="-mt-1 -mr-1 rounded-full p-2 text-muted hover:bg-mist hover:text-ink">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div ref={statusRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {errorMessage && !hasFieldErrors ? (
          <p role="alert" className="mt-3 flex gap-2 rounded-[var(--radius-control)] border-l-[3px] border-danger bg-mist px-3 py-2 text-[0.875rem] font-medium text-ink">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            {errorMessage}
          </p>
        ) : null}
      </div>

      <fieldset key={fieldsKey} disabled={pending} className="mt-3 space-y-2">
        <legend className="sr-only">Данные для обращения</legend>
        <div>
          <label htmlFor={`${p}name`} className={labelClass}>
            Как к вам обращаться <span className="text-bronze-deep" aria-hidden="true">*</span>
          </label>
          <input
            id={`${p}name`}
            name="name"
            type="text"
            autoComplete="name"
            required
            autoFocus
            maxLength={limits.name}
            defaultValue={values.name}
            className={inputClass}
            {...errorProps("name")}
          />
          <FieldError id={`${p}name-error`} message={errors.name} />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0">
            <label htmlFor={`${p}phone`} className={labelClass}>
              Телефон <span className="font-normal text-muted">или</span>
            </label>
            <input
              id={`${p}phone`}
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
          </div>
          <div className="min-w-0">
            <label htmlFor={`${p}email`} className={labelClass}>
              Эл. почта
            </label>
            <input
              id={`${p}email`}
              name="email"
              type="email"
              autoComplete="email"
              maxLength={limits.email}
              defaultValue={values.email}
              className={inputClass}
              {...errorProps("email")}
            />
          </div>
        </div>
        {/* Ошибки телефона и почты — одной строкой на всю ширину, чтобы не переносились в узких колонках. */}
        <FieldError id={`${p}${errors.phone ? "phone" : "email"}-error`} message={contactError} />

        <div>
          <label htmlFor={`${p}service`} className={labelClass}>
            Направление
          </label>
          <div className="relative">
            <select
              id={`${p}service`}
              name="service"
              defaultValue={values.service ?? defaultService}
              className={`${inputClass} appearance-none pr-10`}
              {...errorProps("service")}
            >
              <option value="">Не знаю / нужна консультация</option>
              {services.map((service) => (
                <option key={service.value} value={service.value}>
                  {service.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
          <FieldError id={`${p}service-error`} message={errors.service} />
        </div>

        <div>
          <label htmlFor={`${p}message`} className={labelClass}>
            Опишите задачу <span className="text-bronze-deep" aria-hidden="true">*</span>
          </label>
          <textarea
            id={`${p}message`}
            name="message"
            required
            maxLength={limits.message}
            placeholder="Объект, цель, сроки. Без паспортных данных и сведений о третьих лицах"
            defaultValue={values.message}
            className={`${inputClass} h-16 resize-none sm:h-20`}
            {...errorProps("message")}
          />
          <FieldError id={`${p}message-error`} message={errors.message} />
        </div>

        {/* Ловушка для ботов: поле скрыто от пользователей и вспомогательных технологий. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor={`${p}website`}>Не заполняйте это поле</label>
          <input id={`${p}website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div>
          <div className="flex gap-2.5">
            <input
              id={`${p}consent`}
              name="consent"
              type="checkbox"
              required
              className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 accent-[var(--color-dark)]"
              {...errorProps("consent")}
            />
            <label htmlFor={`${p}consent`} className="text-[0.8125rem] leading-snug text-ink">
              Даю{" "}
              <Link href={legalDocuments.consent.href} target="_blank" className="text-link">
                согласие
              </Link>{" "}
              {company.legalName} на обработку персональных данных (
              <Link href={legalDocuments.policy.href} target="_blank" className="text-link">
                политика
              </Link>
              ) <span className="text-bronze-deep" aria-hidden="true">*</span>
            </label>
          </div>
          <FieldError id={`${p}consent-error`} message={errors.consent} />
        </div>

        <button type="submit" className={buttonClass("primary", "min-h-11 w-full")}>
          {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          {pending ? "Отправляем…" : "Отправить заявку"}
        </button>
      </fieldset>
    </form>
  );
}

/**
 * Кнопка-ссылка «Оставить заявку». Открывает всплывающую форму; без JavaScript,
 * вне провайдера или на самой странице «Контакты» работает как обычная ссылка.
 * Направление и контекст берутся из параметров ссылки (?usluga=…&rekomendaciya=…).
 */
export function RequestTrigger({
  href = "/kontakty#zayavka",
  className,
  children,
  onOpen,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
  /** Вызывается при открытии окна (например, чтобы закрыть мобильное меню) */
  onOpen?: () => void;
}) {
  const openRequest = useContext(RequestModalContext);
  const pathname = usePathname();
  const parsed = useMemo(() => {
    const query = (href.split("?")[1] ?? "").split("#")[0] ?? "";
    return { params: Object.fromEntries(new URLSearchParams(query)) };
  }, [href]);

  // Окно открывается только для ссылок на форму заявки; остальные ссылки работают как обычно.
  const isRequestLink = href.startsWith("/kontakty");
  const intercept = Boolean(openRequest) && isRequestLink && pathname !== "/kontakty";

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!openRequest || !intercept || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    const { usluga, ...rest } = parsed.params;
    onOpen?.();
    openRequest({ service: usluga, params: { ...(usluga ? { usluga } : {}), ...rest } });
  };

  return (
    <Link href={href} onClick={onClick} className={className} aria-haspopup={intercept ? "dialog" : undefined}>
      {children}
    </Link>
  );
}
