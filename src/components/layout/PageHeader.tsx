import Link from "next/link";
import type { ReactNode } from "react";

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  lead?: ReactNode;
  crumbs: Crumb[];
  meta?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({ title, lead, crumbs, meta, children }: PageHeaderProps) {
  return (
    <header className="border-b border-line bg-paper">
      <div className="container-page pt-8 pb-12 sm:pt-10 lg:pb-16">
        <nav aria-label="Навигационная цепочка">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem] text-muted">
            <li>
              <Link href="/" className="hover:text-ink">
                Главная
              </Link>
            </li>
            {crumbs.map((crumb) => (
              <li key={crumb.label} className="flex items-center gap-2">
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
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
        <div className="mt-10 grid gap-6 lg:mt-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-9">
            <h1 className="h-page">{title}</h1>
            {lead ? <div className="lead mt-6 max-w-[44rem]">{lead}</div> : null}
            {meta ? <div className="mt-6 text-[0.875rem] text-muted">{meta}</div> : null}
            {children}
          </div>
        </div>
      </div>
    </header>
  );
}
