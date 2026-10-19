import { MessageCircle, MessageSquare, Send, type LucideIcon } from "lucide-react";
import { company } from "@/config/company";

export type MessengerItem = {
  key: "whatsapp" | "telegram" | "max";
  label: string;
  href: string | null;
  /** Номер для поиска в мессенджере, если прямой ссылки нет */
  phone: string | null;
};

const meta: { key: MessengerItem["key"]; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telegram", label: "Telegram" },
  { key: "max", label: "MAX" },
];

/** Заполненные мессенджеры из src/config/company.ts (пустые не показываются). */
export function getMessengers(): MessengerItem[] {
  const links = company.contacts.messengers;
  return meta.flatMap(({ key, label }) => {
    const { href, phone = null } = links[key];
    return href || phone ? [{ key, label, href, phone }] : [];
  });
}

export const messengerIcons: Record<MessengerItem["key"], LucideIcon> = {
  whatsapp: MessageCircle,
  telegram: Send,
  max: MessageSquare,
};

const styles = {
  compact:
    "inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-dark [&::-webkit-details-marker]:hidden",
  light:
    "inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-line-strong px-3.5 text-[0.875rem] font-medium text-ink transition-colors hover:border-dark [&::-webkit-details-marker]:hidden",
  dark: "inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-white/25 px-3.5 text-[0.875rem] text-white transition-colors hover:border-white [&::-webkit-details-marker]:hidden",
};

/**
 * Кнопки мессенджеров. Варианты: compact — только значки (шапка), light — на светлом фоне,
 * dark — на тёмном (подвал). Мессенджер без ссылки, но с номером открывает подсказку
 * с номером для поиска (на <details>, работает без JavaScript).
 */
export function MessengerLinks({
  variant = "light",
  items = getMessengers(),
  className = "",
}: {
  variant?: keyof typeof styles;
  items?: MessengerItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  const compact = variant === "compact";

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Мессенджеры">
      {items.map((item) => {
        const Icon = messengerIcons[item.key];
        const content = (
          <>
            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            {compact ? null : item.label}
          </>
        );
        if (item.href) {
          return (
            <li key={item.key}>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles[variant]}
                aria-label={compact ? `Написать в ${item.label}` : undefined}
                title={compact ? item.label : undefined}
              >
                {content}
              </a>
            </li>
          );
        }
        return (
          <li key={item.key} className="relative">
            <details className="group">
              <summary className={styles[variant]} aria-label={compact ? `${item.label}: номер для связи` : undefined} title={compact ? item.label : undefined}>
                {content}
              </summary>
              <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-[var(--radius-card)] border border-line bg-white p-4 text-left text-[0.875rem] leading-relaxed text-ink shadow-[0_20px_50px_-24px_rgba(38,55,70,0.45)]">
                <p>
                  Найдите нас в {item.label} по номеру{" "}
                  <span className="font-medium whitespace-nowrap">{item.phone}</span>
                </p>
                {item.key === "max" ? (
                  <a href="https://web.max.ru/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-link">
                    Открыть MAX в браузере
                  </a>
                ) : null}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
