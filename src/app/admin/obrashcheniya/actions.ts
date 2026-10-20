"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { ChannelApiError } from "@/lib/chat/errors";
import { REPLY_MAX_LENGTH } from "@/lib/chat/filters";
import { getAdapter } from "@/lib/chat/registry";
import {
  addChatNote,
  deleteChatClient,
  getChatClient,
  linkChatClients,
  retryChatMessage,
  sendOperatorReply,
  unlinkChatClient,
  updateChatClient,
} from "@/lib/chat/repository";
import { channelLabels } from "@/lib/chat/types";
import { describeDbError } from "@/lib/db";
import { maxApi } from "@/lib/max/api";
import { getMaxConfig, maxProblemText } from "@/lib/max/config";
import { isUuid } from "@/lib/requests/repository";
import { telegramAllowedUpdates, telegramApi } from "@/lib/telegram/api";
import { getTelegramConfig, telegramProblemText } from "@/lib/telegram/config";
import type { ActionState } from "../actions";

const SESSION_EXPIRED: ActionState = { status: "error", message: "Сессия истекла. Войдите снова." };
const GENERIC_ERROR: ActionState = { status: "error", message: "Не удалось выполнить действие из-за технической ошибки. Попробуйте ещё раз." };
const NOTE_MAX_LENGTH = 5000;

/** Каждое действие проверяет сессию администратора на сервере. */
async function authorized(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

const cardPath = (id: string) => `/admin/obrashcheniya/${id}`;

export type ReplyState = ActionState & { sendStatus?: "sent" | "failed" | "unknown" | "skipped"; resetKey?: string };

/** Ответ оператора клиенту в его мессенджер. */
export async function sendReply(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  const key = formData.get("idempotencyKey");
  const raw = formData.get("text");
  if (!isUuid(id) || !isUuid(key) || typeof raw !== "string") return { status: "error", message: "Некорректные данные формы." };
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return { status: "error", message: "Введите текст ответа." };
  if (text.length > REPLY_MAX_LENGTH) return { status: "error", message: `Не более ${REPLY_MAX_LENGTH} символов.` };

  try {
    const client = await getChatClient(id);
    if (!client) return { status: "error", message: "Диалог не найден — возможно, он удалён." };
    const label = channelLabels[client.channel];
    if (!getAdapter(client.channel).isEnabled()) {
      return { status: "error", message: `${label} не настроен на сервере: откройте раздел «Настройки каналов».` };
    }
    const result = await sendOperatorReply(id, text, key);
    revalidatePath(cardPath(id));
    if (result.status === "sent") {
      return {
        status: "success",
        sendStatus: "sent",
        resetKey: key,
        message: result.duplicate
          ? "Этот ответ уже был отправлен ранее — повторно не отправлялся."
          : `${label} подтвердил отправку. Диалог переведён в режим оператора.`,
      };
    }
    if (result.status === "unknown") {
      return {
        status: "error",
        sendStatus: "unknown",
        resetKey: key,
        message: `${label} не подтвердил получение (нет ответа). Сообщение могло дойти — проверьте историю, прежде чем отправлять повторно.`,
      };
    }
    if (result.status === "skipped") {
      return { status: "error", sendStatus: "skipped", resetKey: key, message: "Этот ответ уже обрабатывается — обновите страницу через несколько секунд." };
    }
    return { status: "error", sendStatus: "failed", resetKey: key, message: `Ответ не отправлен: ${result.error ?? "ошибка API"}. Его можно повторить из истории.` };
  } catch (error) {
    console.error("[admin] chat reply failed:", describeDbError(error));
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
    const result = await retryChatMessage(id, messageId, allowUnknown);
    revalidatePath(cardPath(id));
    if (result.status === "sent") return { status: "success", message: "Сообщение отправлено." };
    if (result.status === "skipped") return { status: "error", message: "Сообщение уже отправлено или обрабатывается." };
    if (result.status === "unknown") return { status: "error", message: "Платформа снова не ответила; результат неизвестен." };
    return { status: "error", message: `Не отправлено: ${result.error ?? "ошибка API"}` };
  } catch (error) {
    console.error("[admin] chat retry failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
}

/** Статус диалога, отметка «нужен ответ» и режим (бот / оператор). */
export async function updateDialog(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  const action = formData.get("action");
  if (!isUuid(id)) return { status: "error", message: "Некорректные данные формы." };
  const changes: Record<string, Parameters<typeof updateChatClient>[1] & { message: string }> = {
    close: { status: "closed", message: "Диалог закрыт. Новое сообщение клиента вернёт его в работу." },
    reopen: { status: "open", message: "Диалог возвращён в работу." },
    needs_reply: { needsReply: true, message: "Диалог отмечен как требующий ответа." },
    replied: { needsReply: false, message: "Отметка «нужен ответ» снята." },
    operator: { mode: "operator", message: "Режим оператора: бот не отвечает автоматически." },
    bot: { mode: "bot", message: "Диалог передан боту: автоответы включены, сценарий начнётся с главного меню." },
    qualify: { qualified: true, message: "Обращение отмечено как квалифицированный лид." },
    unqualify: { qualified: false, message: "Отметка «квалифицированный лид» снята." },
  };
  const change = typeof action === "string" ? changes[action] : undefined;
  if (!change) return { status: "error", message: "Неизвестное действие." };
  const { message, ...patch } = change;
  try {
    if (!(await updateChatClient(id, patch))) return { status: "error", message: "Диалог не найден." };
  } catch (error) {
    console.error("[admin] chat dialog update failed:", describeDbError(error));
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
    if (!(await addChatNote(id, body))) return { status: "error", message: "Диалог не найден." };
  } catch (error) {
    console.error("[admin] chat note failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
  revalidatePath(cardPath(id));
  return { status: "success", message: "Заметка добавлена." };
}

/** Ручная связь карточек одного человека (например, MAX и Telegram). Данные не объединяются. */
export async function linkClients(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  const other = formData.get("otherId");
  if (!isUuid(id) || !isUuid(other) || id === other) return { status: "error", message: "Некорректные данные формы." };
  try {
    if (!(await linkChatClients(id, other))) return { status: "error", message: "Карточка не найдена." };
  } catch (error) {
    console.error("[admin] chat link failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
  revalidatePath(cardPath(id));
  revalidatePath(cardPath(other));
  return { status: "success", message: "Карточки связаны." };
}

export async function unlinkClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  if (!isUuid(id)) return { status: "error", message: "Некорректные данные формы." };
  try {
    await unlinkChatClient(id);
  } catch (error) {
    console.error("[admin] chat unlink failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
  revalidatePath(cardPath(id));
  return { status: "success", message: "Связь снята." };
}

export async function removeClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("clientId");
  if (!isUuid(id) || formData.get("confirm") !== "yes") return { status: "error", message: "Удаление не подтверждено." };
  try {
    await deleteChatClient(id);
  } catch (error) {
    console.error("[admin] chat client delete failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
  redirect("/admin/obrashcheniya?deleted=1");
}

// --- Настройки: подключение и Webhook ---

export type SetupState = ActionState & { details?: string[] };

function describeApiError(error: unknown): string {
  if (error instanceof ChannelApiError) return error.summary;
  return "неизвестная ошибка";
}

/** MAX: проверка токена (GET /me) и подписок (GET /subscriptions). */
export async function checkMax(): Promise<SetupState> {
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

export async function registerMax(): Promise<SetupState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const config = getMaxConfig();
  if (config.problems.length > 0) return { status: "error", message: config.problems.map((p) => maxProblemText[p]).join(" ") };
  try {
    const result = await maxApi.subscribe(config.webhookUrl!, config.secret!);
    if (result && result.success === false) return { status: "error", message: `MAX отклонил подписку: ${result.message ?? "без пояснения"}` };
    return { status: "success", message: `Webhook зарегистрирован: ${config.webhookUrl}. Напишите боту в MAX, чтобы проверить приём событий.` };
  } catch (error) {
    return { status: "error", message: `Не удалось зарегистрировать Webhook: ${describeApiError(error)}` };
  }
}

export async function removeMax(): Promise<SetupState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const config = getMaxConfig();
  if (!config.token || !config.webhookUrl) return { status: "error", message: "Не заданы токен или адрес Webhook." };
  try {
    const result = await maxApi.unsubscribe(config.webhookUrl);
    if (result && result.success === false) return { status: "error", message: `MAX отклонил запрос: ${result.message ?? "без пояснения"}` };
    return { status: "success", message: "Подписка этого сайта удалена. События MAX больше не поступают." };
  } catch (error) {
    return { status: "error", message: `Не удалось удалить подписку: ${describeApiError(error)}` };
  }
}

/** Telegram: проверка токена (getMe) и состояния Webhook (getWebhookInfo). */
export async function checkTelegram(): Promise<SetupState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const config = getTelegramConfig();
  if (!config.token) return { status: "error", message: telegramProblemText.token_missing };
  try {
    const me = await telegramApi.getMe();
    const info = await telegramApi.getWebhookInfo();
    const details = [
      `Бот: ${me.first_name}${me.username ? ` @${me.username}` : ""} (id ${me.id})`,
      info.url
        ? `Webhook: ${info.url}${info.url === config.webhookUrl ? " (этот сайт)" : " — НЕ адрес этого сайта"}; события: ${(info.allowed_updates ?? []).join(", ") || "все по умолчанию"}; в очереди: ${info.pending_update_count}`
        : "Webhook не зарегистрирован.",
      ...(info.last_error_message
        ? [`Последняя ошибка доставки: ${info.last_error_message}${info.last_error_date ? ` (${new Date(info.last_error_date * 1000).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК)` : ""}`]
        : []),
    ];
    if (config.username && me.username && config.username.toLowerCase() !== me.username.toLowerCase()) {
      details.push(`TELEGRAM_BOT_USERNAME (${config.username}) не совпадает с username бота (${me.username}).`);
    }
    return { status: "success", message: "Соединение с Telegram Bot API установлено, токен принят.", details };
  } catch (error) {
    return { status: "error", message: `Проверка не прошла: ${describeApiError(error)}` };
  }
}

/** Telegram: setWebhook с адресом, секретом и allowed_updates. */
export async function registerTelegram(): Promise<SetupState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const config = getTelegramConfig();
  const blocking = config.problems.filter((p) => p !== "username_invalid");
  if (blocking.length > 0) return { status: "error", message: blocking.map((p) => telegramProblemText[p]).join(" ") };
  try {
    await telegramApi.setWebhook(config.webhookUrl!, config.secret!);
    return {
      status: "success",
      message: `Webhook зарегистрирован: ${config.webhookUrl} (события: ${telegramAllowedUpdates.join(", ")}). Отправьте боту /start, чтобы проверить приём.`,
    };
  } catch (error) {
    return { status: "error", message: `Не удалось зарегистрировать Webhook: ${describeApiError(error)}` };
  }
}

export async function removeTelegram(): Promise<SetupState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  if (!getTelegramConfig().token) return { status: "error", message: telegramProblemText.token_missing };
  try {
    await telegramApi.deleteWebhook();
    return { status: "success", message: "Webhook Telegram удалён. События больше не поступают." };
  } catch (error) {
    return { status: "error", message: `Не удалось удалить Webhook: ${describeApiError(error)}` };
  }
}
