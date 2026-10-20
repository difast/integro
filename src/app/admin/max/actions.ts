"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { MaxApiError, maxApi } from "@/lib/max/api";
import { getMaxConfig, isMaxEnabled, maxProblemText } from "@/lib/max/config";
import {
  addMaxNote,
  deleteMaxClient,
  getMaxClient,
  retryMaxMessage,
  sendOperatorReply,
  updateMaxClient,
} from "@/lib/max/repository";
import { REPLY_MAX_LENGTH } from "@/lib/max/filters";
import { isUuid } from "@/lib/requests/repository";
import type { ActionState } from "../actions";

const SESSION_EXPIRED: ActionState = { status: "error", message: "Сессия истекла. Войдите снова." };
const GENERIC_ERROR: ActionState = { status: "error", message: "Не удалось выполнить действие из-за технической ошибки. Попробуйте ещё раз." };

const NOTE_MAX_LENGTH = 5000;

async function authorized(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

const cardPath = (id: string) => `/admin/max/${id}`;

export type ReplyState = ActionState & { sendStatus?: "sent" | "failed" | "unknown" | "skipped"; resetKey?: string };

/** Ответ оператора клиенту в MAX. */
export async function sendReply(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  const key = formData.get("idempotencyKey");
  const raw = formData.get("text");
  if (!isUuid(id) || !isUuid(key) || typeof raw !== "string") return { status: "error", message: "Некорректные данные формы." };
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return { status: "error", message: "Введите текст ответа." };
  if (text.length > REPLY_MAX_LENGTH) return { status: "error", message: `Не более ${REPLY_MAX_LENGTH} символов — ограничение MAX.` };

  const config = getMaxConfig();
  if (!isMaxEnabled(config)) {
    return { status: "error", message: "Чат-бот MAX не настроен на сервере: откройте раздел «Настройки MAX»." };
  }

  try {
    const client = await getMaxClient(id);
    if (!client) return { status: "error", message: "Диалог не найден — возможно, он удалён." };
    const result = await sendOperatorReply(id, text, key);
    revalidatePath(cardPath(id));
    if (result.status === "sent") {
      return {
        status: "success",
        sendStatus: "sent",
        resetKey: key,
        message: result.duplicate ? "Этот ответ уже был отправлен ранее — повторно не отправлялся." : "Ответ отправлен в MAX. Диалог переведён в режим оператора.",
      };
    }
    if (result.status === "unknown") {
      return {
        status: "error",
        sendStatus: "unknown",
        resetKey: key,
        message: "MAX не подтвердил получение (нет ответа). Сообщение могло дойти — проверьте историю, прежде чем отправлять повторно.",
      };
    }
    if (result.status === "skipped") {
      return { status: "error", sendStatus: "skipped", resetKey: key, message: "Этот ответ уже обрабатывается — обновите страницу через несколько секунд." };
    }
    return { status: "error", sendStatus: "failed", resetKey: key, message: `Ответ не отправлен: ${result.error ?? "ошибка MAX API"}. Его можно повторить из истории.` };
  } catch (error) {
    console.error("[admin] max reply failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
}

/** Повтор отправки сообщения с ошибкой или неизвестным результатом. */
export async function retryMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  const messageId = formData.get("messageId");
  if (!isUuid(id) || typeof messageId !== "string") return { status: "error", message: "Некорректные данные формы." };
  const allowUnknown = formData.get("confirmUnknown") === "yes";
  try {
    const result = await retryMaxMessage(id, messageId, allowUnknown);
    revalidatePath(cardPath(id));
    if (result.status === "sent") return { status: "success", message: "Сообщение отправлено." };
    if (result.status === "skipped") return { status: "error", message: "Сообщение уже отправлено или обрабатывается." };
    if (result.status === "unknown") return { status: "error", message: "MAX снова не ответил; результат неизвестен." };
    return { status: "error", message: `Не отправлено: ${result.error ?? "ошибка MAX API"}` };
  } catch (error) {
    console.error("[admin] max retry failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
}

/** Статус диалога, отметка «нужен ответ» и режим (бот / оператор). */
export async function updateDialog(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  const action = formData.get("action");
  if (!isUuid(id)) return { status: "error", message: "Некорректные данные формы." };
  const changes: Record<string, Parameters<typeof updateMaxClient>[1] & { message: string }> = {
    close: { status: "closed", message: "Диалог закрыт. Новое сообщение клиента вернёт его в работу." },
    reopen: { status: "open", message: "Диалог возвращён в работу." },
    needs_reply: { needsReply: true, message: "Диалог отмечен как требующий ответа." },
    replied: { needsReply: false, message: "Отметка «нужен ответ» снята." },
    operator: { mode: "operator", message: "Режим оператора: бот не отвечает автоматически." },
    bot: { mode: "bot", message: "Диалог передан боту: автоответы включены, сценарий начнётся с главного меню." },
  };
  const change = typeof action === "string" ? changes[action] : undefined;
  if (!change) return { status: "error", message: "Неизвестное действие." };
  const { message, ...patch } = change;
  try {
    if (!(await updateMaxClient(id, patch))) return { status: "error", message: "Диалог не найден." };
  } catch (error) {
    console.error("[admin] max dialog update failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
  revalidatePath(cardPath(id));
  return { status: "success", message };
}

export async function addNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  const raw = formData.get("body");
  if (!isUuid(id) || typeof raw !== "string") return { status: "error", message: "Некорректные данные формы." };
  const body = raw.replace(/\r\n?/g, "\n").trim();
  if (!body) return { status: "error", message: "Введите текст заметки." };
  if (body.length > NOTE_MAX_LENGTH) return { status: "error", message: `Не более ${NOTE_MAX_LENGTH} символов.` };
  try {
    if (!(await addMaxNote(id, body))) return { status: "error", message: "Диалог не найден." };
  } catch (error) {
    console.error("[admin] max note failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
  revalidatePath(cardPath(id));
  return { status: "success", message: "Заметка добавлена." };
}

export async function removeClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  if (!isUuid(id) || formData.get("confirm") !== "yes") return { status: "error", message: "Удаление не подтверждено." };
  try {
    await deleteMaxClient(id);
  } catch (error) {
    console.error("[admin] max client delete failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
  redirect("/admin/max?deleted=1");
}

// --- Настройки: подключение и Webhook ---

export type SetupState = ActionState & { details?: string[] };

function describeApiError(error: unknown): string {
  if (error instanceof MaxApiError) return error.summary;
  return "неизвестная ошибка";
}

/** Проверка токена (GET /me) и текущих подписок (GET /subscriptions). */
export async function checkConnection(): Promise<SetupState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const config = getMaxConfig();
  if (!config.token) return { status: "error", message: maxProblemText.token_missing };
  try {
    const me = await maxApi.getMe();
    const subs = await maxApi.getSubscriptions();
    const list = subs.subscriptions ?? [];
    const details = [
      `Бот: ${[me.first_name ?? me.name, me.username ? `@${me.username}` : null].filter(Boolean).join(" ")} (id ${me.user_id})`,
      list.length === 0
        ? "Подписок на Webhook нет."
        : `Подписки: ${list.map((s) => `${s.url}${s.url === config.webhookUrl ? " (этот сайт)" : ""} — ${(s.update_types ?? []).join(", ") || "все события"}`).join("; ")}`,
    ];
    return { status: "success", message: "Соединение с MAX API установлено, токен принят.", details };
  } catch (error) {
    return { status: "error", message: `Проверка не прошла: ${describeApiError(error)}` };
  }
}

/** Регистрация Webhook: POST /subscriptions с адресом, секретом и списком событий. */
export async function registerWebhook(): Promise<SetupState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const config = getMaxConfig();
  const blocking = config.problems;
  if (blocking.length > 0) return { status: "error", message: blocking.map((p) => maxProblemText[p]).join(" ") };
  try {
    const result = await maxApi.subscribe(config.webhookUrl!, config.secret!);
    if (result && result.success === false) return { status: "error", message: `MAX отклонил подписку: ${result.message ?? "без пояснения"}` };
    return { status: "success", message: `Webhook зарегистрирован: ${config.webhookUrl}. Напишите боту в MAX, чтобы проверить приём событий.` };
  } catch (error) {
    return { status: "error", message: `Не удалось зарегистрировать Webhook: ${describeApiError(error)}` };
  }
}

/** Отписка адреса этого сайта (например, перед сменой домена). */
export async function removeWebhook(): Promise<SetupState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const config = getMaxConfig();
  if (!config.token || !config.webhookUrl) return { status: "error", message: "Не заданы токен или адрес Webhook." };
  try {
    const result = await maxApi.unsubscribe(config.webhookUrl);
    if (result && result.success === false) return { status: "error", message: `MAX отклонил запрос: ${result.message ?? "без пояснения"}` };
    return { status: "success", message: "Подписка этого сайта удалена. События больше не поступают." };
  } catch (error) {
    return { status: "error", message: `Не удалось удалить подписку: ${describeApiError(error)}` };
  }
}
