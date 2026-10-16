import { company } from "@/config/company";
import { principles } from "@/config/content";
import { team } from "@/config/team";
import { pageMetadata } from "@/lib/metadata";
import { filledRequisites } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CtaBand } from "@/components/sections/CtaBand";
import { DocumentVisual } from "@/components/sections/DocumentVisual";

export const metadata = pageMetadata({
  title: "О компании",
  description:
    "ООО «Интегро» — организация, осуществляющая оценочную деятельность, судебную экспертизу и экспертные исследования. Принципы работы и требования к итоговым документам.",
  path: "/o-kompanii",
});

const signatories = [
  {
    document: "Отчёт об оценке",
    text: "Подписывает оценщик — член саморегулируемой организации оценщиков. Сведения о его членстве в СРО, квалификационном аттестате и страховании ответственности приводятся в отчёте.",
  },
  {
    document: "Заключение эксперта",
    text: "Подписывает эксперт, которому поручено проведение судебной экспертизы. Эксперт предупреждается об уголовной ответственности за дачу заведомо ложного заключения.",
  },
  {
    document: "Заключение специалиста",
    text: "Подписывает специалист, проводивший исследование. Сведения о его образовании и квалификации указываются в заключении.",
  },
];

export default function AboutPage() {
  const requisites = filledRequisites();

  return (
    <>
      <PageHeader
        title="О компании"
        crumbs={[{ label: "О компании" }]}
        lead={`${company.legalName} осуществляет оценочную деятельность, проводит судебные экспертизы и внесудебные экспертные исследования для частных лиц, организаций и судов.`}
      />

      <section aria-labelledby="company-title" className="container-page py-16 lg:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading id="company-title" eyebrow="Организация" title="Юридическое лицо для договора и расчётов" />
            <div className="mt-8 max-w-[64ch] space-y-5 text-lg leading-relaxed">
              <p>
                {company.fullLegalName} — сторона договора с заказчиком. С компанией заключаются договоры на оценку
                и экспертные исследования, проводятся расчёты за услуги и оформляются закрывающие документы.
              </p>
              <p>
                При проведении судебной экспертизы компания действует на основании определения суда о назначении
                экспертизы, а оплата производится в порядке, установленном этим определением.
              </p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[520px] lg:mx-0 lg:justify-self-end">
            <DocumentVisual />
          </div>
        </div>
      </section>

      <section aria-labelledby="principles-title" className="bg-paper py-16 lg:py-24">
        <div className="container-page">
          <SectionHeading id="principles-title" eyebrow="Подход" title="Принципы работы" />
          <ol className="mt-12 grid gap-5 md:grid-cols-2">
            {principles.map((principle, index) => (
              <li key={principle.title} className="reveal rounded-[var(--radius-card)] bg-white p-8 lg:p-10">
                <span className="text-sm font-extrabold tracking-[0.12em] text-accent tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-2xl font-extrabold">{principle.title}</h3>
                <p className="mt-3 text-lg leading-relaxed text-muted">{principle.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="sign-title" className="container-page py-16 lg:py-24">
        <SectionHeading
          id="sign-title"
          eyebrow="Ответственность"
          title="Кто подписывает итоговые документы"
          lead="Требования к лицам, подписывающим отчёты и заключения, установлены законом. Сведения о специалисте приводятся в самом документе."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line md:grid-cols-3">
          {signatories.map((item) => (
            <div key={item.document} className="reveal bg-white p-8">
              <h3 className="text-xl font-extrabold">{item.document}</h3>
              <span className="rule mt-5" aria-hidden="true" />
              <p className="mt-5 leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {team.length > 0 ? (
        <section aria-labelledby="team-title" className="bg-paper py-16 lg:py-24">
          <div className="container-page">
            <SectionHeading id="team-title" eyebrow="Команда" title="Специалисты" />
            <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {team.map((person) => (
                <li key={person.name} className="rounded-[var(--radius-card)] bg-white p-8">
                  <h3 className="text-xl font-extrabold">{person.name}</h3>
                  <p className="mt-1 font-semibold text-accent">{person.position}</p>
                  <ul className="mt-5 space-y-2 text-muted">
                    {person.credentials.map((credential) => (
                      <li key={credential}>{credential}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {requisites.length > 0 ? (
        <section aria-labelledby="requisites-title" className="container-page pb-4 lg:pb-8">
          <h2 id="requisites-title" className="text-2xl font-extrabold sm:text-[1.75rem]">
            Реквизиты
          </h2>
          <dl className="mt-6 grid gap-x-10 border-t border-line sm:grid-cols-2">
            <div className="flex flex-col gap-1 border-b border-line py-4">
              <dt className="text-sm text-muted">Полное наименование</dt>
              <dd className="font-semibold text-ink">{company.fullLegalName}</dd>
            </div>
            {requisites.map((item) => (
              <div key={item.label} className="flex flex-col gap-1 border-b border-line py-4">
                <dt className="text-sm text-muted">{item.label}</dt>
                <dd className="font-semibold break-words text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <CtaBand />
    </>
  );
}
