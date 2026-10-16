"use server";

import { headers } from "next/headers";
import { company } from "@/config/company";
import { services } from "@/config/services";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { isRateLimited } from "@/lib/rate-limit";
import { limits, type RequestFields, type RequestFormState } from "@/lib/request-form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_FILL_MS = 3_000;

function field(formData: FormData, key: string, max: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function submitRequest(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const values: RequestFields = {
    name: field(formData, "name", limits.name),
    phone: field(formData, "phone", limits.phone),
    email: field(formData, "email", limits.email),
    service: field(formData, "service", 64),
    message: field(formData, "message", limits.message),
  };

  // Защита от спама: скрытое поле и минимальное время заполнения формы.
  const honeypot = field(formData, "website", 200);
  const startedAt = Number(field(formData, "startedAt", 20));
  if (honeypot || !startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    return {
      status: "error",
      message: "Не удалось отправить заявку. Подождите несколько секунд и попробуйте ещё раз.",
      values,
    };
  }

  const fieldErrors: RequestFormState["fieldErrors"] = {};
  if (values.name.length < 2) fieldErrors.name = "Укажите, как к вам обращаться";

  const phoneDigits = values.phone.replace(/\D/g, "");
  if (values.phone && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
    fieldErrors.phone = "Проверьте номер телефона";
  }
  if (values.email && !EMAIL_RE.test(values.email)) fieldErrors.email = "Проверьте адрес электронной почты";
  if (!values.phone && !values.email) fieldErrors.phone = "Укажите телефон или электронную почту для ответа";

  const serviceTitle =
    values.service === "" || values.service === "other"
      ? "Не выбрано"
      : services.find((service) => service.slug === values.service)?.title;
  if (!serviceTitle) fieldErrors.service = "Выберите направление из списка";

  if (values.message.length < 10) fieldErrors.message = "Кратко опишите задачу (не менее 10 символов)";
  if (formData.get("consent") !== "on") fieldErrors.consent = "Необходимо согласие на обработку персональных данных";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Проверьте заполнение формы.", fieldErrors, values };
  }

  if (!isMailConfigured()) {
    console.error("[request-form] SMTP is not configured: set SMTP_* and MAIL_TO environment variables");
    return {
      status: "error",
      message: "Приём заявок через сайт временно недоступен. Приносим извинения.",
      values,
    };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  if (isRateLimited(ip)) {
    return {
      status: "error",
      message: "Слишком много заявок за короткое время. Попробуйте позже.",
      values,
    };
  }

  const text = [
    `Новая заявка с сайта ${company.legalName}`,
    "",
    `Имя: ${values.name}`,
    `Телефон: ${values.phone || "—"}`,
    `Email: ${values.email || "—"}`,
    `Направление: ${serviceTitle}`,
    "",
    "Описание задачи:",
    values.message,
    "",
    `Отправлено: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} (МСК)`,
    `Заявитель отметил согласие на обработку персональных данных (редакция согласия от ${company.legalRevisionDate}).`,
  ].join("\n");

  try {
    await sendMail({
      subject: `Заявка с сайта: ${serviceTitle === "Не выбрано" ? "обращение" : serviceTitle}`,
      text,
      replyTo: values.email || undefined,
    });
  } catch (error) {
    console.error("[request-form] failed to send email", error);
    return {
      status: "error",
      message: "Не удалось отправить заявку из-за технической ошибки. Попробуйте позже или свяжитесь с нами напрямую.",
      values,
    };
  }

  return {
    status: "success",
    message: "Заявка отправлена. Мы свяжемся с вами по указанным контактам.",
  };
}
