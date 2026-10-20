"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { getBackupConfig } from "@/lib/backup/config";
import { runBackup } from "@/lib/backup/run";
import { processEvent } from "@/lib/chat/processor";
import { describeDbError } from "@/lib/db";
import { retryDelivery } from "@/lib/notifications/delivery";
import { resetFailedEvent } from "@/lib/ops/dashboard";
import { runHealthChecks } from "@/lib/ops/health";
import { saveRetentionSettings } from "@/lib/ops/retention";
import type { ActionState } from "../actions";

const SESSION_EXPIRED: ActionState = { status: "error", message: "Сессия истекла. Войдите снова." };

async function authorized(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

// Не чаще одной ручной копии в 5 минут — защита от случайных повторных нажатий и нагрузки на базу.
let lastManualBackup = 0;

export async function backupNow(): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  if (!getBackupConfig().s3) return { status: "error", message: "Хранилище S3 не настроено — используйте «Скачать зашифрованную копию» или задайте BACKUP_S3_*." };
  if (Date.now() - lastManualBackup < 5 * 60_000) return { status: "error", message: "Копия создавалась меньше 5 минут назад." };
  lastManualBackup = Date.now();
  const result = await runBackup("manual", { upload: true });
  revalidatePath("/admin/sistema");
  return result.ok
    ? { status: "success", message: `Копия создана: ${result.location}, ${Math.round(result.size / 1024)} КБ, строк: ${result.rows}.` }
    : { status: "error", message: `Копия не создана: ${result.error}` };
}

export async function checkIntegrationsNow(): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  await runHealthChecks();
  revalidatePath("/admin/sistema");
  return { status: "success", message: "Проверка выполнена, результаты обновлены." };
}

export async function retryOperation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const kind = formData.get("kind");
  const id = formData.get("id");
  if (typeof id !== "string") return { status: "error", message: "Некорректные данные." };
  try {
    if (kind === "event") {
      if (!(await resetFailedEvent(id))) return { status: "error", message: "Событие уже обработано или недоступно для повтора." };
      await processEvent(id);
    } else if (kind === "delivery") {
      if (!(await retryDelivery(id))) return { status: "error", message: "Доставка уже выполнена или недоступна для повтора." };
    } else {
      return { status: "error", message: "Этот тип операции повторять нельзя." };
    }
  } catch (error) {
    console.error("[admin] retry failed:", describeDbError(error));
    return { status: "error", message: "Повтор не удался — подробности в журнале." };
  }
  revalidatePath("/admin/sistema");
  return { status: "success", message: "Операция запущена повторно. Результат — в списке и журнале." };
}

export async function saveRetention(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const parse = (name: string): number | null | "bad" => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 30 && n <= 3650 ? n : "bad";
  };
  const chatDays = parse("chatDays");
  const requestDays = parse("requestDays");
  if (chatDays === "bad" || requestDays === "bad") return { status: "error", message: "Срок — целое число дней от 30 до 3650 или пусто (не удалять)." };
  try {
    await saveRetentionSettings({ chatDays, requestDays });
  } catch (error) {
    console.error("[admin] retention save failed:", describeDbError(error));
    return { status: "error", message: "Не удалось сохранить." };
  }
  revalidatePath("/admin/sistema");
  return { status: "success", message: "Сроки хранения сохранены. Удаление выполняется раз в сутки." };
}
