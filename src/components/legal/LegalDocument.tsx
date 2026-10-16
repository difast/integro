import type { ReactNode } from "react";

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:marker:text-accent">
        {children}
      </div>
    </section>
  );
}

export function LegalBody({ children }: { children: ReactNode }) {
  return <div className="container-page max-w-[860px] py-14 text-body lg:py-20">{children}</div>;
}
