import type { ReactNode } from "react";
import Link from "next/link";
import { company } from "@/config/company";
import { legalIndexPath } from "@/config/legal";
import { PageHeader } from "@/components/layout/PageHeader";

export type LegalSectionData = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalDocumentProps = {
  title: string;
  lead?: ReactNode;
  sections: LegalSectionData[];
  /** Показывать дату редакции юридических документов */
  showRevision?: boolean;
};

/** Пункт документа с номером: «1.1. Текст». */
export function Clause({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[3.25rem_minmax(0,1fr)]">
      <span className="pt-px text-[0.875rem] text-muted tabular-nums">{n}</span>
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}

/** Маркированный список внутри пункта. */
export function Items({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-2 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:text-accent [&>li]:before:content-['—']">
      {children}
    </ul>
  );
}

/** Блок «название — значение» внутри документа. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="border-t border-line text-[0.9375rem]">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-6">
          <dt className="text-muted">{row.label}</dt>
          <dd className="text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Toc({ sections }: { sections: LegalSectionData[] }) {
  return (
    <ol className="space-y-2.5 text-[0.875rem] leading-snug">
      {sections.map((section, index) => (
        <li key={section.id} className="grid grid-cols-[1.75rem_1fr]">
          <span className="text-muted tabular-nums">{index + 1}.</span>
          <a href={`#${section.id}`} className="text-body hover:text-ink hover:underline hover:underline-offset-4">
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function LegalDocument({ title, lead, sections, showRevision = true }: LegalDocumentProps) {
  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: "Правовая информация", href: legalIndexPath }, { label: title }]}
        lead={lead}
        meta={showRevision ? <>Редакция от {company.legalRevisionDate}</> : undefined}
      />

      <div className="container-page grid gap-10 py-12 lg:grid-cols-12 lg:gap-8 lg:py-20">
        <aside className="lg:col-span-3">
          <details className="group border-y border-line lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
              Содержание
              <span aria-hidden="true" className="text-accent group-open:hidden">
                +
              </span>
              <span aria-hidden="true" className="hidden text-accent group-open:inline">
                −
              </span>
            </summary>
            <div className="pb-5">
              <Toc sections={sections} />
            </div>
          </details>
          <nav aria-label="Содержание документа" className="hidden lg:sticky lg:top-28 lg:block">
            <p className="label">Содержание</p>
            <div className="mt-5 border-t border-line pt-5">
              <Toc sections={sections} />
            </div>
          </nav>
        </aside>

        <article className="min-w-0 lg:col-span-8 lg:col-start-5">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28 border-t border-ink pt-6 pb-10 first:pt-6 lg:pb-12">
              <h2 id={`${section.id}-title`} className="text-[1.25rem] leading-snug sm:text-[1.375rem]">
                <span className="mr-3 text-accent tabular-nums">{index + 1}.</span>
                {section.title}
              </h2>
              <div className="mt-6 space-y-5 text-[1rem] leading-[1.7] sm:text-[1.0625rem]">{section.content}</div>
            </section>
          ))}
          <p className="border-t border-line pt-6 text-[0.875rem] text-muted">
            Другие документы — в разделе{" "}
            <Link href={legalIndexPath} className="text-link">
              «Правовая информация»
            </Link>
            .
          </p>
        </article>
      </div>
    </>
  );
}
