import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  inverted?: boolean;
  className?: string;
};

export function SectionHeading({ eyebrow, title, lead, id, inverted = false, className = "" }: SectionHeadingProps) {
  return (
    <div className={`max-w-3xl ${className}`}>
      {eyebrow ? <p className={`eyebrow mb-4 ${inverted ? "text-white/70" : ""}`}>{eyebrow}</p> : null}
      <h2
        id={id}
        className={`text-[1.85rem] leading-[1.12] font-extrabold tracking-[-0.02em] sm:text-[2.4rem] ${inverted ? "text-white" : ""}`}
      >
        {title}
      </h2>
      {lead ? (
        <p className={`mt-5 text-lg leading-relaxed ${inverted ? "text-navy-200" : "text-muted"}`}>{lead}</p>
      ) : null}
    </div>
  );
}
