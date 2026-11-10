"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { parseMarketingLinkForm } from "@/lib/marketing/links";
import { createMarketingLink, setMarketingLinkActive } from "@/lib/marketing/repository";
import type { ActionState } from "../actions";

const SESSION_EXPIRED: ActionState = { status: "error", message: "Сессия истекла. Войдите снова." };
const GENERIC_ERROR: ActionState = { status: "error", message: "Не удалось выполнить действие. Попробуйте ещё раз." };

async function authorized(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function createLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const parsed = parseMarketingLinkForm(formData);
  if ("error" in parsed) return { status: "error", message: parsed.error };
  try {
    const result = await createMarketingLink(parsed.link);
    if (result === "duplicate") return { status: "error", message: "Ссылка с таким коротким именем уже есть — выберите другое." };
    revalidatePath("/admin/marketing");
    return { status: "success", message: "Ссылка добавлена." };
  } catch (error) {
    console.error("[admin] create marketing link failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
}

export async function toggleLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!Number.isInteger(id) || id <= 0) return GENERIC_ERROR;
  try {
    if (!(await setMarketingLinkActive(id, active))) return GENERIC_ERROR;
    revalidatePath("/admin/marketing");
    return { status: "success", message: active ? "Ссылка включена." : "Ссылка отключена: переходы ведут на главную и не считаются." };
  } catch (error) {
    console.error("[admin] toggle marketing link failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
}
