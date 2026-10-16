import type { ReactNode } from "react";

type SectionProps = {
  /** id заголовка для aria-labelledby */
  id: string;
  /** якорь раздела */
  anchor?: string;
  index?: string;
  label: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  tone?: "white" | "paper";
  children?: ReactNode;
};

/**
 * Раздел страницы на 12-колоночной сетке: слева подпись с номером,
 * справа заголовок и содержимое. Верхняя линейка задаёт ритм страницы.
 */
export function Section({ id, anchor, index, label, title, lead, action, tone = "white", children }: SectionProps) {
  return (
    <section id={anchor} aria-labelledby={id} className={tone === "paper" ? "bg-paper" : undefined}>
      <div className="container-page py-16 lg:py-24">
        <div className="grid gap-6 border-t border-ink pt-6 lg:grid-cols-12 lg:gap-8 lg:pt-8">
          <p className="label lg:col-span-3">
            {index ? <span className="label-index">{index}</span> : null}
            {label}
          </p>
          <div className="lg:col-span-9">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-[40rem]">
                <h2 id={id} className="h-section">
                  {title}
                </h2>
                {lead ? <p className="lead mt-4">{lead}</p> : null}
              </div>
              {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            {children ? <div className="mt-10 lg:mt-12">{children}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
