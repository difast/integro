import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { RequestTrigger } from "./RequestModal";

type Variant = Parameters<typeof buttonClass>[0];

/** Кнопка «Оставить заявку» в стиле ButtonLink, открывающая всплывающую форму. */
export function RequestButton({
  href = "/kontakty#zayavka",
  variant = "primary",
  className = "",
  children,
}: {
  href?: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <RequestTrigger href={href} className={buttonClass(variant, className)}>
      {children}
    </RequestTrigger>
  );
}
