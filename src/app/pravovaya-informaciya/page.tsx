import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { company } from "@/config/company";
import { legalDocumentList, legalIndexPath } from "@/config/legal";
import { pageMetadata } from "@/lib/metadata";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = pageMetadata({
  title: "Правовая информация",
  description:
    "Правовая информация ООО «Интегро»: сведения об организации, политика обработки персональных данных и согласие на обработку персональных данных.",
  path: legalIndexPath,
});

export default function LegalIndexPage() {
  return (
    <>
      <PageHeader
        title="Правовая информация"
        crumbs={[{ label: "Правовая информация" }]}
        lead="Официальные сведения об организации и документы об обработке персональных данных на сайте."
        meta={<>Редакция документов от {company.legalRevisionDate}</>}
      />
      <section aria-label="Документы" className="container-page mt-10 lg:mt-14">
        <ul className="grid gap-4 md:grid-cols-3">
          {legalDocumentList.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                className="group flex h-full flex-col justify-between gap-8 rounded-[var(--radius-card)] bg-white p-7"
              >
                <span>
                  <span aria-hidden="true" className="block h-[2px] w-8 bg-bronze" />
                  <span className="mt-5 block text-[1.25rem] leading-snug font-medium text-ink group-hover:underline group-hover:decoration-bronze group-hover:underline-offset-[5px]">
                    {doc.title}
                  </span>
                  <span className="mt-3 block text-[0.9375rem] leading-relaxed text-muted">{doc.description}</span>
                </span>
                <span className="inline-flex h-11 w-11 items-center justify-center self-end rounded-full bg-mist text-ink transition-colors group-hover:bg-dark group-hover:text-white">
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
