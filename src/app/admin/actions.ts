"use server";

import { redirect } from "next/navigation";
import { describeDbError } from "@/lib/db";
import { getClientIp } from "@/lib/client-ip";
import { adminSetupProblems, endSession, requireAdmin, startSession, UnauthorizedError } from "@/lib/admin/auth";
import { verifyAdminPassword } from "@/lib/admin/password";
import { clearFailedLogins, deleteAllSessions, isLoginBlocked, recordFailedLogin } from "@/lib/admin/session-store";
import { deleteRequest, isUuid, updateRequest } from "@/lib/requests/repository";
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

export async function saveRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { status: "error", message: "Сессия истекла. Войдите снова." };
  }

  const id = formData.get("id");
  const status = formData.get("status");
  const notes = formData.get("notes");
  if (!isUuid(id) || !isRequestStatus(status) || typeof notes !== "string") {
    return { status: "error", message: "Некорректные данные формы." };
  }
  if (notes.length > NOTES_MAX_LENGTH) {
    return { status: "error", message: `Заметки не должны превышать ${NOTES_MAX_LENGTH} символов.` };
  }

  try {
    const updated = await updateRequest(id, { status, notes: notes.replace(/\r\n?/g, "\n").trim() });
    if (!updated) return { status: "error", message: "Заявка не найдена — возможно, она удалена." };
  } catch (error) {
    console.error("[admin] update failed:", describeDbError(error));
    return { status: "error", message: GENERIC_ERROR };
  }
  return { status: "success", message: "Изменения сохранены." };
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
