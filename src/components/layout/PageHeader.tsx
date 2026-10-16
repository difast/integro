import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  lead?: ReactNode;
  crumbs: Crumb[];
  eyebrow?: string;
  children?: ReactNode;
};

export function PageHeader({ title, lead, crumbs, eyebrow, children }: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-paper">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 hidden h-full w-[34%] bg-navy-900 lg:block"
        style={{ clipPath: "polygon(22% 0, 100% 0, 100% 100%, 0 100%)" }}
      />
      <div className="container-page relative py-10 sm:py-14 lg:py-16">
        <nav aria-label="Навигационная цепочка">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <li>
              <Link href="/" className="hover:text-ink">
                Главная
              </Link>
            </li>
            {crumbs.map((crumb) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-ink">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-8 max-w-3xl lg:max-w-[60%]">
          {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
          <h1 className="text-[2.1rem] leading-[1.08] font-extrabold tracking-[-0.025em] sm:text-5xl lg:text-[3.4rem]">
            {title}
          </h1>
          {lead ? <div className="mt-6 text-lg leading-relaxed text-muted sm:text-xl">{lead}</div> : null}
          {children}
        </div>
      </div>
    </section>
  );
}
