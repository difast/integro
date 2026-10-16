import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { company } from "@/config/company";
import { phoneHref } from "@/lib/site";

type ContactListProps = {
  inverted?: boolean;
  size?: "md" | "lg";
  className?: string;
};

/** Выводит только заполненные контакты из src/config/company.ts. */
export function ContactList({ inverted = false, size = "md", className = "" }: ContactListProps) {
  const { phone, email, officeAddress, workingHours } = company.contacts;
  const iconClass = `mt-1 h-4 w-4 shrink-0 ${inverted ? "text-white/60" : "text-accent"}`;
  const strong = inverted ? "text-white" : "text-ink";
  const soft = inverted ? "text-navy-200" : "text-muted";

  if (!phone && !email && !officeAddress && !workingHours) return null;

  return (
    <ul className={`space-y-4 ${className}`}>
      {phone ? (
        <li className="flex gap-3">
          <Phone aria-hidden="true" className={iconClass} />
          <a
            href={phoneHref(phone)}
            className={`font-extrabold ${size === "lg" ? "text-2xl" : "text-lg"} ${strong} hover:text-accent`}
          >
            {phone}
          </a>
        </li>
      ) : null}
      {email ? (
        <li className="flex gap-3">
          <Mail aria-hidden="true" className={iconClass} />
          <a href={`mailto:${email}`} className={`link-underline font-semibold break-all ${strong}`}>
            {email}
          </a>
        </li>
      ) : null}
      {officeAddress ? (
        <li className={`flex gap-3 leading-relaxed ${soft}`}>
          <MapPin aria-hidden="true" className={iconClass} />
          <address className="not-italic">{officeAddress}</address>
        </li>
      ) : null}
      {workingHours ? (
        <li className={`flex gap-3 ${soft}`}>
          <Clock aria-hidden="true" className={iconClass} />
          <span>{workingHours}</span>
        </li>
      ) : null}
    </ul>
  );
}
