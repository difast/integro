import Link from "next/link";
import { legalDocumentList, legalDocuments } from "@/config/legal";
import { pageMetadata } from "@/lib/metadata";
import { organizationDetails } from "@/lib/organization";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailsTable } from "@/components/ui/DetailsTable";
import { RequestButton } from "@/components/request/RequestButton";

const doc = legalDocuments.organization;

export const metadata = pageMetadata({
  title: doc.title,
  description:
    "Официальные сведения об ООО «Интегро»: полное наименование, ОГРН, ИНН, КПП, юридический адрес и часы связи.",
  path: doc.href,
});

export default function OrganizationPage() {
  return (
    <>
      <PageHeader
        title={doc.title}
        crumbs={[{ label: "Правовая информация", href: "/pravovaya-informaciya" }, { label: doc.title }]}
        lead="Официальные сведения об организации, через которую заключаются договоры и проводятся расчёты за услуги."
      />
      <div className="container-page mt-10 grid gap-4 lg:mt-14 lg:grid-cols-12">
        <section aria-labelledby="details-title" className="panel bg-white p-6 sm:p-10 lg:col-span-8">
          <h2 id="details-title" className="sr-only">
            Реквизиты
          </h2>
          <DetailsTable rows={organizationDetails()} />
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <RequestButton>Оставить заявку</RequestButton>
          </div>
        </section>
        <aside aria-labelledby="docs-title" className="self-start rounded-[var(--radius-card)] bg-white p-6 lg:col-span-4">
          <h2 id="docs-title" className="text-[0.875rem] font-medium text-muted">
            Документы
          </h2>
          <ul className="mt-5 border-t border-line text-[0.9375rem]">
            {legalDocumentList
              .filter((item) => item.href !== doc.href)
              .map((item) => (
                <li key={item.href} className="border-b border-line py-3.5">
                  <Link href={item.href} className="text-link">
                    {item.title}
                  </Link>
                </li>
              ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
