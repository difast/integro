import { MessageSquare } from "lucide-react";
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
  return meta.flatMap(({ key, label }) => {
    const { href } = links[key];
    return href ? [{ key, label, href }] : [];
  });
}

// Фирменные знаки и цвета WhatsApp и Telegram (контуры — Simple Icons, CC0).
// Белая подложка под знаком делает его одинаковым на светлом и тёмном фоне.
const WHATSAPP_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";
const TELEGRAM_PATH =
  "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10.5" fill="#fff" />
      <path d={WHATSAPP_PATH} fill="#25D366" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11" fill="#fff" />
      <path d={TELEGRAM_PATH} fill="#26A5E4" />
    </svg>
  );
}

// Логотип MAX добавим вместе со ссылкой на чат-бота; до этого кнопка не показывается.
function MaxIcon({ className }: { className?: string }) {
  return <MessageSquare aria-hidden="true" className={className} strokeWidth={1.75} />;
}

export const messengerIcons: Record<MessengerItem["key"], (props: { className?: string }) => React.JSX.Element> = {
  whatsapp: WhatsAppIcon,
  telegram: TelegramIcon,
  max: MaxIcon,
};

const styles = {
  compact:
    "inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-110",
  light:
    "inline-flex min-h-11 items-center gap-2.5 rounded-full border border-line-strong py-1 pr-4 pl-1.5 text-[0.9375rem] font-medium text-ink transition-colors hover:border-dark",
  dark: "inline-flex min-h-11 items-center gap-2.5 rounded-full border border-white/25 py-1 pr-4 pl-1.5 text-[0.9375rem] text-white transition-colors hover:border-white",
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
  variant?: keyof typeof styles;
  items?: MessengerItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  const compact = variant === "compact";

  return (
    <ul className={`flex flex-wrap items-center ${compact ? "gap-1" : "gap-2"} ${className}`} aria-label="Мессенджеры">
      {items.map((item) => {
        const Icon = messengerIcons[item.key];
        const content = (
          <>
            <Icon className={compact ? "h-9 w-9" : "h-8 w-8"} />
            {compact ? null : item.label}
          </>
        );
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
      })}
    </ul>
  );
}
