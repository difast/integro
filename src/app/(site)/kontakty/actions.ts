"use server";

import { company } from "@/config/company";
import { services } from "@/config/services";
import { getClientIp } from "@/lib/client-ip";
import { describeDbError, isDatabaseConfigured } from "@/lib/db";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { isRateLimited } from "@/lib/rate-limit";
import { limits, validateRequest, type RequestFields, type RequestFormState } from "@/lib/request-form";
import { describeRequestContext } from "@/lib/requests/context";
import { createRequest, isUuid } from "@/lib/requests/repository";
import { absoluteUrl } from "@/lib/site";

const MIN_FILL_MS = 3_000;

function field(formData: FormData, key: string, max: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Путь страницы с формой: только относительный адрес сайта, без протокола и домена. */
function sourcePage(formData: FormData): string | null {
  const value = field(formData, "page", 300);
  return /^\/(?!\/)[\w\-./?=&%~]*$/.test(value) ? value : null;
}

const SUBMIT_ERROR =
  "Не удалось отправить заявку из-за технической ошибки. Попробуйте ещё раз немного позже или свяжитесь с нами напрямую.";

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

  // Те же правила, что и в браузере (src/lib/request-form.ts), — сервер проверяет всё повторно.
  const fieldErrors: RequestFormState["fieldErrors"] = validateRequest(values, formData.get("consent") === "on");

  const serviceTitle =
    values.service === "" || values.service === "other"
      ? "Не выбрано"
      : services.find((service) => service.slug === values.service)?.title;
  if (!serviceTitle) fieldErrors.service = "Выберите направление из списка";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Проверьте заполнение формы.", fieldErrors, values };
  }

  const databaseEnabled = isDatabaseConfigured();
  const mailEnabled = isMailConfigured();
  if (!databaseEnabled && !mailEnabled) {
    console.error("[request-form] request storage is not configured: set DATABASE_URL (and optionally SMTP_*)");
    return {
      status: "error",
      message: "Приём заявок через сайт временно недоступен. Приносим извинения.",
      values,
    };
  }

  // Ключ отправки создаётся в браузере при открытии формы: повторная отправка той же
  // заявки (двойное нажатие, повтор после сбоя сети) не создаёт дубликат.
  const submissionKey = field(formData, "submissionKey", 36);
  if (!isUuid(submissionKey)) {
    return { status: "error", message: "Не удалось отправить заявку. Обновите страницу и попробуйте ещё раз.", values };
  }

  if (isRateLimited(await getClientIp())) {
    return {
      status: "error",
      message: "Слишком много заявок за короткое время. Попробуйте позже.",
      values,
    };
  }

  const page = sourcePage(formData);
  const context = describeRequestContext(page);
  let requestId: string | null = null;
  let isNew = true;
  if (databaseEnabled) {
    try {
      const saved = await createRequest({
        submissionKey,
        name: values.name,
        phone: values.phone,
        email: values.email,
        service: values.service === "other" ? "" : values.service,
        serviceTitle: serviceTitle as string,
        message: values.message,
        sourcePage: page,
        context,
        consentRevision: company.legalRevisionDate,
      });
      requestId = saved.id;
      isNew = saved.created;
    } catch (error) {
      // В журнал — только код и текст ошибки, без данных заявки.
      console.error("[request-form] failed to save request:", describeDbError(error));
      return { status: "error", message: SUBMIT_ERROR, values };
    }
  }

  if (mailEnabled && isNew) {
    const adminLink = requestId ? absoluteUrl(`/admin/zayavki/${requestId}`) : null;
    const text = [
      `Новая заявка с сайта ${company.legalName}`,
      "",
      `Имя: ${values.name}`,
      `Телефон: ${values.phone || "—"}`,
      `Email: ${values.email || "—"}`,
      `Направление: ${serviceTitle}`,
      ...(context ? [`Контекст: ${context}`] : []),
      "",
      "Описание задачи:",
      values.message,
      "",
      `Отправлено: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} (МСК)`,
      `Заявитель отметил согласие на обработку персональных данных (редакция согласия от ${company.legalRevisionDate}).`,
      ...(adminLink ? ["", `Заявка в панели администратора: ${adminLink}`] : []),
    ].join("\n");

    try {
      await sendMail({
        subject: `Заявка с сайта: ${serviceTitle === "Не выбрано" ? "обращение" : serviceTitle}`,
        text,
        replyTo: values.email || undefined,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      if (!databaseEnabled) {
        console.error("[request-form] failed to send email:", reason);
        return { status: "error", message: SUBMIT_ERROR, values };
      }
      // Заявка уже сохранена в базе — письмо только уведомление.
      console.error("[request-form] request saved, notification email failed:", reason);
    }
  }

  return {
    status: "success",
    message: "Заявка отправлена. Мы свяжемся с вами по указанным контактам.",
  };
}
