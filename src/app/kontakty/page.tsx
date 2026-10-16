import { company } from "@/config/company";
import { services } from "@/config/services";
import { isMailConfigured } from "@/lib/mail";
import { pageMetadata } from "@/lib/metadata";
import { filledRequisites, hasAnyContact } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContactList } from "@/components/ui/ContactList";
import { RequestForm } from "@/components/sections/RequestForm";

export const metadata = pageMetadata({
  title: "Контакты",
  description:
    "Контакты ООО «Интегро» и форма обращения: опишите задачу по оценке, судебной экспертизе или экспертному исследованию, и мы сообщим о возможности её решения, сроках и стоимости.",
  path: "/kontakty",
});

// Страница читает параметры запроса и настройки SMTP во время выполнения.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ usluga?: string | string[] }> };

export default async function ContactsPage({ searchParams }: Props) {
  const { usluga } = await searchParams;
  const requested = Array.isArray(usluga) ? usluga[0] : usluga;
  const defaultService = services.some((service) => service.slug === requested) ? requested : "";
  const requisites = filledRequisites();
  const showContacts = hasAnyContact();

  return (
    <>
      <PageHeader
        title="Контакты"
        crumbs={[{ label: "Контакты" }]}
        lead="Опишите задачу — после предварительного анализа сообщим, возможно ли её решение, какие материалы потребуются, а также сроки и стоимость работ."
      />

      <div className="container-page grid gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-20 lg:py-24">
        <div className="space-y-12">
          {showContacts ? (
            <section aria-labelledby="contacts-title">
              <h2 id="contacts-title" className="eyebrow">
                Связаться с нами
              </h2>
              <ContactList size="lg" className="mt-6" />
            </section>
          ) : null}

          <section aria-labelledby="how-title">
            <h2 id="how-title" className="text-2xl font-extrabold sm:text-[1.75rem]">
              Что указать в обращении
            </h2>
            <ul className="mt-6 space-y-4 text-lg leading-relaxed">
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                Объект оценки или исследования и его местонахождение
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                Цель: для чего и в какой срок нужен результат
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                Для судебной экспертизы — суд, номер дела и предполагаемые вопросы
              </li>
            </ul>
          </section>

          {requisites.length > 0 ? (
            <section aria-labelledby="requisites-title" className="rounded-[var(--radius-card)] bg-paper p-7">
              <h2 id="requisites-title" className="text-xl font-extrabold">
                Реквизиты
              </h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-muted">Наименование</dt>
                  <dd className="font-semibold text-ink">{company.fullLegalName}</dd>
                </div>
                {requisites.map((item) => (
                  <div key={item.label}>
                    <dt className="text-muted">{item.label}</dt>
                    <dd className="font-semibold break-words text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>

        <section
          id="zayavka"
          aria-labelledby="form-title"
          className="scroll-mt-28 rounded-[var(--radius-card)] border border-line p-6 shadow-[0_24px_70px_-40px_rgba(10,20,48,0.4)] sm:p-10"
        >
          <h2 id="form-title" className="text-[1.75rem] font-extrabold tracking-[-0.02em] sm:text-[2.1rem]">
            Заявка
          </h2>
          <p className="mt-3 mb-8 text-muted">Поля, отмеченные звёздочкой, обязательны.</p>
          <RequestForm
            services={services.map((service) => ({ value: service.slug, label: service.title }))}
            defaultService={defaultService}
            enabled={isMailConfigured()}
            showSetupHint={process.env.NODE_ENV !== "production"}
            hasContacts={showContacts}
          />
        </section>
      </div>
    </>
  );
}
