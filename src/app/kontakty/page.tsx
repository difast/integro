import Link from "next/link";
import { legalDocuments } from "@/config/legal";
import { services } from "@/config/services";
import { isMailConfigured } from "@/lib/mail";
import { pageMetadata } from "@/lib/metadata";
import { organizationDetails } from "@/lib/organization";
import { hasAnyContact } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContactList } from "@/components/ui/ContactList";
import { RequestForm } from "@/components/sections/RequestForm";

export const metadata = pageMetadata({
  title: "Контакты",
  description:
    "Заявка в ООО «Интегро»: опишите задачу по оценке, судебной экспертизе или экспертному исследованию. Часы связи, юридический адрес и реквизиты организации.",
  path: "/kontakty",
});

// Страница читает параметры запроса и настройки SMTP во время выполнения.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ usluga?: string | string[] }> };

const shortDetails = ["Юридический адрес", "ОГРН", "ИНН", "КПП"];

export default async function ContactsPage({ searchParams }: Props) {
  const { usluga } = await searchParams;
  const requested = Array.isArray(usluga) ? usluga[0] : usluga;
  const defaultService = services.some((service) => service.slug === requested) ? requested : "";
  const details = organizationDetails().filter((row) => shortDetails.includes(row.label));

  return (
    <>
      <PageHeader
        title="Контакты"
        crumbs={[{ label: "Контакты" }]}
        lead="Опишите задачу — после предварительного анализа сообщим, возможно ли её решение, какие материалы потребуются, а также сроки и стоимость работ."
      />

      <div className="container-page grid gap-14 py-14 lg:grid-cols-12 lg:gap-8 lg:py-20">
        <div className="space-y-12 lg:col-span-4">
          <section aria-labelledby="contacts-title">
            <h2 id="contacts-title" className="label">
              Связь
            </h2>
            <ContactList className="mt-5" />
          </section>

          <section aria-labelledby="how-title">
            <h2 id="how-title" className="label">
              Что указать в заявке
            </h2>
            <ul className="mt-5 space-y-3 border-t border-line pt-5 text-[0.9375rem] leading-relaxed">
              {[
                "Объект оценки или исследования и его местонахождение",
                "Цель: для чего и в какой срок нужен результат",
                "Для судебной экспертизы — суд, номер дела и предполагаемые вопросы",
              ].map((item) => (
                <li key={item} className="grid grid-cols-[1rem_1fr]">
                  <span aria-hidden="true" className="text-accent">
                    —
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="org-title">
            <h2 id="org-title" className="label">
              Организация
            </h2>
            <dl className="mt-5 border-t border-line text-[0.9375rem]">
              {details.map((row) => (
                <div key={row.label} className="border-b border-line py-3">
                  <dt className="text-[0.8125rem] text-muted">{row.label}</dt>
                  <dd className="mt-0.5 text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
            <Link href={legalDocuments.organization.href} className="text-link mt-4 inline-block text-[0.875rem]">
              Все сведения об организации
            </Link>
          </section>
        </div>

        <section
          id="zayavka"
          aria-labelledby="form-title"
          className="scroll-mt-28 border-t-[3px] border-navy-900 bg-paper p-6 sm:p-10 lg:col-span-7 lg:col-start-6"
        >
          <h2 id="form-title" className="h-section">
            Заявка
          </h2>
          <p className="mt-3 mb-8 text-[0.9375rem] text-muted">
            Поля, отмеченные <span className="text-accent">*</span>, обязательны.
          </p>
          <RequestForm
            services={services.map((service) => ({ value: service.slug, label: service.title }))}
            defaultService={defaultService}
            enabled={isMailConfigured()}
            showSetupHint={process.env.NODE_ENV !== "production"}
            hasContacts={hasAnyContact()}
          />
        </section>
      </div>
    </>
  );
}
