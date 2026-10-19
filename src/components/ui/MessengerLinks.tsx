import { MessageCircle, MessageSquare, Send, type LucideIcon } from "lucide-react";
import { company } from "@/config/company";

export type MessengerItem = { key: "whatsapp" | "telegram" | "max"; label: string; href: string };

const meta: { key: MessengerItem["key"]; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telegram", label: "Telegram" },
  { key: "max", label: "MAX" },
];

/** Заполненные мессенджеры из src/config/company.ts (пустые не показываются). */
export function getMessengers(): MessengerItem[] {
  const links = company.contacts.messengers;
  return meta.flatMap(({ key, label }) => (links[key] ? [{ key, label, href: links[key] as string }] : []));
}

export const messengerIcons: Record<MessengerItem["key"], LucideIcon> = {
  whatsapp: MessageCircle,
  telegram: Send,
  max: MessageSquare,
};

/**
 * Кнопки мессенджеров. Варианты: compact — только значки (шапка), light — на светлом фоне,
 * dark — на тёмном (подвал). Пока ни одна ссылка не задана, компонент ничего не выводит.
 */
export function MessengerLinks({
  variant = "light",
  items = getMessengers(),
  className = "",
}: {
  variant?: "compact" | "light" | "dark";
  items?: MessengerItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  const styles = {
    compact:
      "inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-dark",
    light:
      "inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong px-3.5 text-[0.875rem] font-medium text-ink transition-colors hover:border-dark",
    dark: "inline-flex min-h-10 items-center gap-2 rounded-full border border-white/25 px-3.5 text-[0.875rem] text-white transition-colors hover:border-white",
  }[variant];

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Мессенджеры">
      {items.map((item) => {
        const Icon = messengerIcons[item.key];
        return (
          <li key={item.key}>
            <a href={item.href} target="_blank" rel="noopener noreferrer" className={styles} aria-label={variant === "compact" ? `Написать в ${item.label}` : undefined}>
              <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              {variant === "compact" ? null : item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
