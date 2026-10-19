import type { ReactNode } from "react";
import { company } from "@/config/company";
import { phoneHref } from "@/lib/site";
import { getMessengers, MessengerLinks } from "@/components/ui/MessengerLinks";

/** Только заполненные способы связи из src/config/company.ts. */
export function ContactList({ className = "" }: { className?: string }) {
  const { phone, email, officeAddress, workingHours } = company.contacts;
  const rows: { label: string; value: ReactNode }[] = [];
  if (phone) rows.push({ label: "Телефон", value: <a href={phoneHref(phone)} className="text-link">{phone}</a> });
  const messengers = getMessengers();
  if (messengers.length > 0) rows.push({ label: "Мессенджеры", value: <MessengerLinks placement="contacts" items={messengers} className="mt-1" /> });
  if (email) rows.push({ label: "Электронная почта", value: <a href={`mailto:${email}`} className="text-link break-all">{email}</a> });
  if (officeAddress) rows.push({ label: "Адрес офиса", value: <address className="not-italic">{officeAddress}</address> });
  if (workingHours) rows.push({ label: "Часы связи", value: workingHours });
  if (rows.length === 0) return null;

  return (
    <dl className={`border-t border-line ${className}`}>
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 border-b border-line py-4">
          <dt className="text-[0.875rem] text-muted">{row.label}</dt>
          <dd className="font-medium text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
