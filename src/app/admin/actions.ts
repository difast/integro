"use server";

import { redirect } from "next/navigation";
import { describeDbError } from "@/lib/db";
import { getClientIp } from "@/lib/client-ip";
import { adminSetupProblems, endSession, requireAdmin, startSession, UnauthorizedError } from "@/lib/admin/auth";
import { verifyAdminPassword } from "@/lib/admin/password";
import { clearFailedLogins, deleteAllSessions, isLoginBlocked, recordFailedLogin } from "@/lib/admin/session-store";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { company } from "@/config/company";
import { services } from "@/config/services";
import { getChatClient } from "@/lib/chat/repository";
import { CURRENCIES, isPaymentStatus, isRequestChannel, isRequestStage, manualChannels, type RequestChannel } from "@/lib/requests/funnel";
import { recordRequestCreated } from "@/lib/requests/history";
import { parseDate, parseMoney } from "@/lib/requests/parse";
import { createRequest, deleteRequest, isUuid, listLossReasons, saveLossReason, updateRequestWork } from "@/lib/requests/repository";
import { isRequestStatus, NOTES_MAX_LENGTH } from "@/lib/requests/statuses";

export type ActionState = { status: "idle" | "success" | "error"; message?: string };

const GENERIC_ERROR = "Не удалось выполнить действие из-за технической ошибки. Попробуйте ещё раз.";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (adminSetupProblems().length > 0) {
    return { status: "error", message: "Вход отключён: администратор сервера не завершил настройку." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    return { status: "error", message: "Введите пароль." };
  }

  const ip = await getClientIp();
  try {
    if (await isLoginBlocked(ip)) {
      return { status: "error", message: "Слишком много неудачных попыток. Повторите вход через 15 минут." };
    }
    if (!verifyAdminPassword(password)) {
      await recordFailedLogin(ip);
      // Небольшая задержка дополнительно замедляет перебор.
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { status: "error", message: "Неверный пароль." };
    }
    await clearFailedLogins(ip);
    await startSession();
  } catch (error) {
    console.error("[admin] login failed:", describeDbError(error));
    return { status: "error", message: "Вход временно недоступен: нет связи с базой данных." };
  }
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/admin/vhod");
}

/** Завершает все сессии администратора (например, после смены пароля). */
export async function logoutEverywhere(): Promise<void> {
  try {
    await requireAdmin();
    await deleteAllSessions();
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) console.error("[admin] logout everywhere failed:", describeDbError(error));
  }
  await endSession();
  redirect("/admin/vhod");
}

const text = (raw: FormDataEntryValue | null, max: number) => (typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");

export async function saveRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { status: "error", message: "Сессия истекла. Войдите снова." };
  }

  const id = formData.get("id");
  const status = formData.get("status");
  const notes = formData.get("notes");
  const stage = formData.get("stage");
  const channel = formData.get("channel");
  const paymentStatus = formData.get("paymentStatus");
  const currency = formData.get("currency");
  if (!isUuid(id) || !isRequestStatus(status) || typeof notes !== "string" || !isRequestStage(stage) || !isRequestChannel(channel) || !isPaymentStatus(paymentStatus)) {
    return { status: "error", message: "Некорректные данные формы." };
  }
  if (typeof currency !== "string" || !(CURRENCIES as readonly string[]).includes(currency)) return { status: "error", message: "Выберите валюту из списка." };
  if (notes.length > NOTES_MAX_LENGTH) {
    return { status: "error", message: `Заметки не должны превышать ${NOTES_MAX_LENGTH} символов.` };
  }
  const dealAmount = parseMoney(formData.get("dealAmount"));
  const paidAmount = parseMoney(formData.get("paidAmount"));
  const contractDate = parseDate(formData.get("contractDate"));
  const paidAt = parseDate(formData.get("paidAt"));
  if (dealAmount === "bad" || paidAmount === "bad") return { status: "error", message: "Сумма — число, например 15000 или 15 000,50." };
  if (contractDate === "bad" || paidAt === "bad") return { status: "error", message: "Проверьте даты." };
  if (paymentStatus !== "none" && !paidAmount) return { status: "error", message: "Укажите полученную сумму или выберите «Оплаты нет»." };
  const lossRaw = formData.get("lossReasonId");
  const lossReasonId = typeof lossRaw === "string" && /^\d{1,9}$/.test(lossRaw) ? Number(lossRaw) : null;
  if (stage === "lost" && lossReasonId === null) return { status: "error", message: "Для проигранной сделки выберите причину потери." };

  try {
    if (lossReasonId !== null && !(await listLossReasons(true)).some((r) => r.id === lossReasonId)) {
      return { status: "error", message: "Причина потери не найдена." };
    }
    const updated = await updateRequestWork(id, {
      status,
      notes: notes.replace(/\r\n?/g, "\n").trim(),
      stage,
      lossReasonId,
      lossComment: text(formData.get("lossComment"), 500) || null,
      assignee: text(formData.get("assignee"), 100) || null,
      channel,
      sourceNote: text(formData.get("sourceNote"), 200) || null,
      dealAmount,
      currency,
      contractDate,
      paymentStatus,
      paidAmount,
      paidAt,
    });
    if (!updated) return { status: "error", message: "Заявка не найдена — возможно, она удалена." };
  } catch (error) {
    console.error("[admin] update failed:", describeDbError(error));
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath(`/admin/zayavki/${id}`);
  return { status: "success", message: "Изменения сохранены." };
}

/** Заявка, зарегистрированная вручную: обращение по WhatsApp, Авито, телефону, почте и т. п. */
export async function createManualRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { status: "error", message: "Сессия истекла. Войдите снова." };
  }
  const channel = formData.get("channel");
  const chatClientId = formData.get("chatClientId");
  const name = text(formData.get("name"), 100);
  const phone = text(formData.get("phone"), 30);
  const email = text(formData.get("email"), 120);
  const message = text(formData.get("message"), 3000);
  const serviceSlug = text(formData.get("service"), 64);
  const service = services.find((s) => s.slug === serviceSlug);

  let resolvedChannel: RequestChannel;
  let linkedClient: string | null = null;
  if (isUuid(chatClientId)) {
    // Заявка из диалога: канал и клиент берутся из карточки, а не из формы.
    const client = await getChatClient(chatClientId).catch(() => null);
    if (!client) return { status: "error", message: "Диалог не найден." };
    resolvedChannel = client.channel;
    linkedClient = client.id;
  } else if (typeof channel === "string" && manualChannels.some((c) => c.value === channel)) {
    resolvedChannel = channel as RequestChannel;
  } else {
    return { status: "error", message: "Выберите канал обращения." };
  }
  if (name.length < 2) return { status: "error", message: "Укажите имя клиента." };
  if (message.length < 5) return { status: "error", message: "Кратко опишите обращение." };

  let id: string;
  try {
    const saved = await createRequest({
      submissionKey: randomUUID(),
      name,
      phone,
      email,
      service: service?.slug ?? "",
      serviceTitle: service?.title ?? "Не выбрано",
      message,
      sourcePage: null,
      context: linkedClient ? "Создана оператором из диалога" : "Зарегистрирована вручную",
      // Согласие на обработку ПД при ручной регистрации подтверждает оператор (см. ADMIN_OPERATIONS.md).
      consentRevision: company.legalRevisionDate,
      channel: resolvedChannel,
      chatClientId: linkedClient,
      sourceNote: text(formData.get("sourceNote"), 200) || null,
    });
    id = saved.id;
    await recordRequestCreated(id, "admin");
  } catch (error) {
    console.error("[admin] manual request failed:", describeDbError(error));
    return { status: "error", message: GENERIC_ERROR };
  }
  redirect(`/admin/zayavki/${id}?created=1`);
}

export async function saveLossReasonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { status: "error", message: "Сессия истекла. Войдите снова." };
  }
  const rawId = formData.get("id");
  const id = typeof rawId === "string" && /^\d{1,9}$/.test(rawId) ? Number(rawId) : undefined;
  const title = text(formData.get("title"), 100);
  const sort = Number(formData.get("sort") ?? 0);
  if (!title) return { status: "error", message: "Укажите название причины." };
  try {
    await saveLossReason({ id, title, active: formData.get("active") === "on", sort: Number.isInteger(sort) ? sort : 0 });
  } catch (error) {
    const duplicate = (error as { code?: string }).code === "23505";
    if (!duplicate) console.error("[admin] loss reason failed:", describeDbError(error));
    return { status: "error", message: duplicate ? "Такая причина уже есть." : GENERIC_ERROR };
  }
  revalidatePath("/admin/analitika/prichiny");
  return { status: "success", message: "Сохранено." };
}

export async function removeRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { status: "error", message: "Сессия истекла. Войдите снова." };
  }

  const id = formData.get("id");
  if (!isUuid(id) || formData.get("confirm") !== "yes") {
    return { status: "error", message: "Удаление не подтверждено." };
  }

  try {
    await deleteRequest(id);
  } catch (error) {
    console.error("[admin] delete failed:", describeDbError(error));
    return { status: "error", message: GENERIC_ERROR };
  }
  redirect("/admin?deleted=1");
}
