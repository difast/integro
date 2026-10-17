import type { ReactNode } from "react";

/**
 * Заголовок раздела без нумерации: бронзовая линия-маркер, заголовок,
 * пояснение и (необязательно) действие справа.
 */
export function SectionHead({
  id,
  eyebrow,
  title,
  lead,
  action,
  tone = "light",
  className = "",
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={`flex flex-col gap-6 md:flex-row md:items-end md:justify-between ${className}`}>
      <div className="max-w-[44rem]">
        {eyebrow ? (
          <p className={`flex items-center gap-3 text-[0.875rem] font-medium ${dark ? "text-on-dark" : "text-muted"}`}>
            <span aria-hidden="true" className="h-[2px] w-8 bg-bronze" />
            {eyebrow}
          </p>
        ) : null}
        <h2 id={id} className={`h-section ${eyebrow ? "mt-4" : ""} ${dark ? "text-white" : ""}`}>
          {title}
        </h2>
        {lead ? <p className={`mt-4 text-[1.0625rem] leading-relaxed ${dark ? "text-on-dark" : "text-muted"}`}>{lead}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
