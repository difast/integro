import { company } from "@/config/company";

/**
 * Ключи VAPID для браузерных push-уведомлений (Web Push).
 * VAPID_PUBLIC_KEY  — публичный ключ (передаётся браузеру при подписке).
 * VAPID_PRIVATE_KEY — секретный ключ, только на сервере.
 * VAPID_SUBJECT     — контакт отправителя (mailto: или https:), по умолчанию почта компании.
 * Сгенерировать: npx web-push generate-vapid-keys
 */
export type PushConfig = { publicKey: string; privateKey: string; subject: string } | null;

const KEY_RE = /^[A-Za-z0-9_-]{40,120}$/;

export function getPushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey || !KEY_RE.test(publicKey) || !KEY_RE.test(privateKey)) return null;
  const subject = env.VAPID_SUBJECT?.trim() || (company.contacts.email ? `mailto:${company.contacts.email}` : "");
  if (!/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}
