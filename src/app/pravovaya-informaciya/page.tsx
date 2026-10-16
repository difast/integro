import Link from "next/link";
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
      <section aria-label="Документы" className="container-page py-12 lg:py-20">
        <ol className="border-t border-ink">
          {legalDocumentList.map((doc, index) => (
            <li key={doc.href} className="border-b border-line">
              <Link href={doc.href} className="group grid gap-3 py-8 lg:grid-cols-12 lg:gap-8">
                <span className="text-[0.875rem] font-medium text-accent tabular-nums lg:col-span-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="lg:col-span-9">
                  <span className="block text-[1.25rem] font-semibold text-ink group-hover:underline group-hover:decoration-accent group-hover:underline-offset-[5px] sm:text-[1.375rem]">
                    {doc.title}
                  </span>
                  <span className="mt-2 block max-w-[40rem] text-muted">{doc.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
