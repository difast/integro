import Link from "next/link";
import type { ReactNode } from "react";

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  lead?: ReactNode;
  crumbs: Crumb[];
  meta?: ReactNode;
  children?: ReactNode;
  /** Дополнительный блок справа (на десктопе) */
  aside?: ReactNode;
};

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Навигационная цепочка">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem] text-muted">
        <li>
          <Link href="/" className="hover:text-ink">
            Главная
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.label} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-bronze" />
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
  );
}

/** Шапка внутренней страницы: белая панель на светлом фоне, как в референсе. */
export function PageHeader({ title, lead, crumbs, meta, children, aside }: PageHeaderProps) {
  return (
    <div className="container-page pt-6 sm:pt-8">
      <header className="panel bg-white px-5 pt-7 pb-10 sm:px-10 sm:pt-9 sm:pb-12 lg:px-12">
        <Breadcrumbs crumbs={crumbs} />
        <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-12 lg:items-end">
          <div className={aside ? "lg:col-span-8" : "lg:col-span-10"}>
            <h1 className="h-page">{title}</h1>
            {lead ? <div className="lead mt-5 max-w-[46rem]">{lead}</div> : null}
            {meta ? <div className="mt-5 text-[0.875rem] text-muted">{meta}</div> : null}
            {children}
          </div>
          {aside ? <div className="lg:col-span-4">{aside}</div> : null}
        </div>
      </header>
    </div>
  );
}
