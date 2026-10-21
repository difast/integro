"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import type { ActionState } from "@/app/admin/actions";
import { describeDbError } from "@/lib/db";
import { NUMBER_FIELDS, parsers, type FactSource, type NumberField, type PlanInput } from "@/lib/sales-plan/calc";
import { isPeriod } from "@/lib/sales-plan/period";
import {
  deletePlan,
  listDirections,
  saveDirectionTitles,
  savePlans,
  type PlanChange,
  type PlanRecord,
  type PlanValues,
} from "@/lib/sales-plan/repository";

/** Запись плана для клиента (дата — строкой, чтобы пройти сериализацию серверного действия). */
export type PlanSnapshot = { input: PlanInput; version: number; updatedAt: string };

export type SavePlanResult =
  | { status: "saved"; saved: Record<string, PlanSnapshot> }
  | { status: "conflict"; conflicts: Record<string, PlanSnapshot | null> }
  | { status: "invalid"; errors: Record<string, Partial<Record<NumberField, string>>> }
  | { status: "error"; message: string };

export type ResetPlanResult = { status: "deleted" } | { status: "conflict" } | { status: "error"; message: string };

const SESSION_EXPIRED = "Сессия истекла. Войдите снова — введённые значения останутся на странице.";
const toSnapshot = (r: PlanRecord): PlanSnapshot => ({ input: r.input, version: r.version, updatedAt: r.updatedAt.toISOString() });
const isSource = (v: unknown): v is FactSource => v === "auto" || v === "manual";

/** Сохранение значений месяца по направлениям. Числа проверяются здесь заново — клиентской проверке не доверяем. */
export async function savePlanAction(payload: {
  period: string;
  rows: { directionId: string; version: number | null; input: PlanInput }[];
}): Promise<SavePlanResult> {
  if (!(await isAdmin())) return { status: "error", message: SESSION_EXPIRED };
  if (!payload || !isPeriod(payload.period) || !Array.isArray(payload.rows) || payload.rows.length === 0 || payload.rows.length > 20) {
    return { status: "error", message: "Некорректные данные запроса." };
  }
  try {
    const known = new Set((await listDirections()).map((d) => d.id));
    const seen = new Set<string>();
    const changes: PlanChange[] = [];
    const errors: Record<string, Partial<Record<NumberField, string>>> = {};
    for (const row of payload.rows) {
      const input = row?.input;
      if (!row || !known.has(row.directionId) || seen.has(row.directionId) || !input) return { status: "error", message: "Некорректные данные запроса." };
      if (row.version !== null && !(Number.isInteger(row.version) && row.version > 0)) return { status: "error", message: "Некорректные данные запроса." };
      if (!isSource(input.revenueSource) || !isSource(input.salesSource) || !isSource(input.leadsSource)) return { status: "error", message: "Некорректные данные запроса." };
      seen.add(row.directionId);
      const values: Partial<PlanValues> = { revenueSource: input.revenueSource, salesSource: input.salesSource, leadsSource: input.leadsSource };
      for (const field of NUMBER_FIELDS) {
        const raw = input[field];
        if (raw !== null && typeof raw !== "string") return { status: "error", message: "Некорректные данные запроса." };
        const parsed = parsers[field](raw);
        if (parsed.ok) values[field] = parsed.value;
        else (errors[row.directionId] ??= {})[field] = parsed.error;
      }
      changes.push({ directionId: row.directionId, version: row.version, values: values as PlanValues });
    }
    if (Object.keys(errors).length) return { status: "invalid", errors };

    const result = await savePlans(payload.period, changes);
    revalidatePath("/admin/plan-prodazh");
    if (!result.ok) {
      return { status: "conflict", conflicts: Object.fromEntries(Object.entries(result.conflicts).map(([id, r]) => [id, r ? toSnapshot(r) : null])) };
    }
    return { status: "saved", saved: Object.fromEntries(Object.entries(result.saved).map(([id, r]) => [id, toSnapshot(r)])) };
  } catch (error) {
    console.error("[admin] sales plan save failed:", describeDbError(error));
    return { status: "error", message: "Не удалось сохранить: ошибка сервера или базы данных. Значения остались на странице — повторите попытку." };
  }
}

/** Сброс всех значений месяца по направлению (удаление записи). */
export async function resetPlanAction(payload: { period: string; directionId: string; version: number }): Promise<ResetPlanResult> {
  if (!(await isAdmin())) return { status: "error", message: SESSION_EXPIRED };
  if (!payload || !isPeriod(payload.period) || typeof payload.directionId !== "string" || !Number.isInteger(payload.version)) {
    return { status: "error", message: "Некорректные данные запроса." };
  }
  try {
    const ok = await deletePlan(payload.period, payload.directionId, payload.version);
    revalidatePath("/admin/plan-prodazh");
    return ok ? { status: "deleted" } : { status: "conflict" };
  } catch (error) {
    console.error("[admin] sales plan reset failed:", describeDbError(error));
    return { status: "error", message: "Не удалось сбросить значения. Повторите попытку." };
  }
}

/** Названия направлений (идентификаторы и логика расчётов не меняются). */
export async function saveDirectionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return { status: "error", message: "Сессия истекла. Войдите снова." };
  try {
    const directions = await listDirections();
    const titles: Record<string, string> = {};
    for (const d of directions) {
      const raw = formData.get(`title_${d.id}`);
      const title = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
      if (!title || title.length > 100) return { status: "error", message: "Название направления — от 1 до 100 символов." };
      titles[d.id] = title;
    }
    if (new Set(Object.values(titles).map((t) => t.toLowerCase())).size !== directions.length) {
      return { status: "error", message: "Названия направлений не должны совпадать." };
    }
    await saveDirectionTitles(titles);
  } catch (error) {
    console.error("[admin] sales directions save failed:", describeDbError(error));
    return { status: "error", message: "Не удалось сохранить названия. Повторите попытку." };
  }
  revalidatePath("/admin/plan-prodazh");
  return { status: "success", message: "Названия сохранены." };
}
