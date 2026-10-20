"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { submitRequest } from "@/app/(site)/kontakty/actions";
import { initialRequestState, validateRequest, type RequestFieldName } from "@/lib/request-form";
import { readAttribution } from "@/lib/requests/attribution";

function newSubmissionKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Запасной вариант для старых браузеров: UUID v4 из криптографического генератора.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const fieldOrder: RequestFieldName[] = ["name", "phone", "email", "message", "consent"];

/**
 * Общая логика формы заявки (страница «Контакты» и всплывающее окно):
 * проверка в браузере, защита от автоматической отправки и дубликатов, отправка
 * серверного действия и восстановление введённых значений после ответа.
 *
 * idPrefix — префикс id полей, если на странице несколько форм.
 * pageParams — дополнительный контекст обращения, добавляется к адресу страницы.
 */
export function useRequestForm({ idPrefix = "", pageParams }: { idPrefix?: string; pageParams?: Record<string, string> } = {}) {
  const [state, formAction, pending] = useActionState(submitRequest, initialRequestState);
  const startedAtRef = useRef(0);
  const submissionKeyRef = useRef("");
  const statusRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Ошибки проверки в браузере: при них форма не отправляется на сервер.
  const [clientErrors, setClientErrors] = useState<Partial<Record<RequestFieldName, string>> | null>(null);

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
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(pageParams ?? {})) params.set(key, value);
    const query = params.toString();
    formData.set("page", `${window.location.pathname}${query ? `?${query}` : ""}`);
    formData.set("attribution", readAttribution());
    formAction(formData);
  };

  // Проверка до отправки. Выполняется в onSubmit, а не в action: отмена здесь не
  // запускает действие формы, и React не очищает уже введённые значения.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const found = validateRequest(
      { name: text("name"), phone: text("phone"), email: text("email"), message: text("message") },
      data.get("consent") === "on",
    );
    if (Object.keys(found).length > 0) {
      event.preventDefault();
      setClientErrors(found);
      const first = fieldOrder.find((name) => found[name]);
      if (first) requestAnimationFrame(() => document.getElementById(`${idPrefix}${first}`)?.focus());
      return;
    }
    setClientErrors(null);
  };

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      submissionKeyRef.current = newSubmissionKey();
    }
    if (state.status !== "idle") statusRef.current?.focus();
  }, [state]);

  const errors = clientErrors ?? state.fieldErrors ?? {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errorProps = (name: RequestFieldName) =>
    errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${idPrefix}${name}-error` } : {};

  return {
    state,
    pending,
    submit,
    handleSubmit,
    clientErrors,
    errors,
    values,
    errorProps,
    statusRef,
    formRef,
    // Ключ пересоздаёт поля после ответа сервера, чтобы восстановить введённые значения.
    fieldsKey: `${state.status}-${JSON.stringify(values)}`,
    success: state.status === "success" && !clientErrors,
    errorMessage: clientErrors ? "Проверьте заполнение формы." : state.status === "error" ? state.message : undefined,
  };
}
