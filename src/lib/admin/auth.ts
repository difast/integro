import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { describeDbError, isDatabaseConfigured } from "@/lib/db";
import { adminPasswordStatus } from "./password";
import { createSession, deleteSession, isSessionValid, SESSION_TTL_MS } from "./session-store";

/**
 * Сессия администратора: случайный токен в cookie (HttpOnly, SameSite=Lax,
 * Secure в production), в базе — только его хеш. Срок жизни — 8 часов.
 *
 * SameSite=Lax: cookie не отправляется с межсайтовыми POST-запросами, а Server
 * Actions дополнительно сверяют заголовки Origin и Host (защита от CSRF).
 * Lax, а не Strict, — чтобы ссылка на заявку из письма открывалась без повторного входа.
 */

const isProduction = process.env.NODE_ENV === "production";
// Префикс __Host- запрещает установку cookie с поддоменов и без Secure.
export const SESSION_COOKIE = isProduction ? "__Host-integro-admin" : "integro-admin";

export type AdminSetupProblem = "password_missing" | "password_too_short" | "database_missing";

/** Что мешает включить вход. Пустой список — вход доступен. */
export function adminSetupProblems(): AdminSetupProblem[] {
  const problems: AdminSetupProblem[] = [];
  const password = adminPasswordStatus();
  if (password === "missing") problems.push("password_missing");
  if (password === "too_short") problems.push("password_too_short");
  if (!isDatabaseConfigured()) problems.push("database_missing");
  return problems;
}

export async function startSession(): Promise<void> {
  const { token } = await createSession();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token).catch(() => {});
  store.delete({ name: SESSION_COOKIE, path: "/", secure: isProduction, httpOnly: true, sameSite: "lax" });
}

/** true — действующая сессия. Без пароля в окружении сессии не признаются. */
export async function isAdmin(): Promise<boolean> {
  if (adminSetupProblems().length > 0) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    return await isSessionValid(token);
  } catch (error) {
    console.error("[admin] session check failed:", describeDbError(error));
    return false;
  }
}

/** Для страниц админки: без сессии — на страницу входа. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhod");
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Для серверных действий и API: без сессии — исключение. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new UnauthorizedError();
}
