import "server-only";
import { cookies } from "next/headers";
import { isSameOrigin, noStore } from "@/lib/admin/origin";
import { WEBCHAT_SESSION_DAYS } from "./service";

/** Cookie сессии веб-чата: HttpOnly (недоступна скриптам), Secure и префикс __Host- в production, SameSite=Lax. */
const isProduction = process.env.NODE_ENV === "production";
export const WEBCHAT_COOKIE = isProduction ? "__Host-integro-chat" : "integro-chat";

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(WEBCHAT_COOKIE)?.value ?? null;
}

export async function writeSessionToken(token: string): Promise<void> {
  (await cookies()).set(WEBCHAT_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: WEBCHAT_SESSION_DAYS * 24 * 3600,
  });
}

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...noStore, ...extra } });

/** Изменяющие запросы принимаются только с этого же сайта и только в JSON (защита от CSRF). */
export function isAcceptableWrite(request: Request): boolean {
  return isSameOrigin(request) && (request.headers.get("content-type") ?? "").startsWith("application/json");
}
