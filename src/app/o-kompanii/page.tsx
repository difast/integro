import Link from "next/link";
import { company } from "@/config/company";
import { principles } from "@/config/content";
import { legalDocuments } from "@/config/legal";
import { team } from "@/config/team";
import { pageMetadata } from "@/lib/metadata";
import { organizationDetails } from "@/lib/organization";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailsTable } from "@/components/ui/DetailsTable";
import { Section } from "@/components/ui/Section";
import { CtaBand } from "@/components/sections/CtaBand";

export const metadata = pageMetadata({
  title: "О компании",
  description:
    "ООО «Интегро» — оценочная деятельность, судебная экспертиза и экспертные исследования. Принципы работы, требования к итоговым документам и сведения об организации.",
  path: "/o-kompanii",
});

const signatories = [
  {
    document: "Отчёт об оценке",
    text: "Подписывает оценщик — член саморегулируемой организации оценщиков. Сведения о членстве оценщика в СРО, его квалификационном аттестате и страховании ответственности приводятся в отчёте.",
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
  return (
    <>
      <PageHeader
        title="О компании"
        crumbs={[{ label: "О компании" }]}
        lead={`${company.legalName} осуществляет оценочную деятельность, проводит судебные экспертизы и внесудебные экспертные исследования для частных лиц, организаций и судов.`}
      />

      <Section id="company-title" index="01" label="Организация" title="Сторона договора и расчётов">
        <div className="prose-text">
          <p>
            {company.fullLegalName} — сторона договора с заказчиком. С компанией заключаются договоры на оценку и
            экспертные исследования, проводятся расчёты за услуги и оформляются закрывающие документы.
          </p>
          <p>
            При проведении судебной экспертизы компания действует на основании определения суда о назначении
            экспертизы, а оплата производится в порядке, установленном этим определением.
          </p>
        </div>
      </Section>

      <Section id="principles-title" index="02" label="Подход" title="Принципы работы" tone="paper">
        <ol className="grid gap-x-10 sm:grid-cols-2">
          {principles.map((principle, index) => (
            <li key={principle.title} className="border-t border-line py-7">
              <span className="text-[0.875rem] font-medium text-accent tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-[1.125rem]">{principle.title}</h3>
              <p className="mt-3 text-muted">{principle.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="sign-title"
        index="03"
        label="Ответственность"
        title="Кто подписывает итоговые документы"
        lead="Требования к лицам, подписывающим отчёты и заключения, установлены законом. Сведения о специалисте приводятся в самом документе."
      >
        <dl className="border-t border-line">
          {signatories.map((item) => (
            <div key={item.document} className="grid gap-2 border-b border-line py-6 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-8">
              <dt className="font-semibold text-ink">{item.document}</dt>
              <dd className="max-w-[40rem] text-muted">{item.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {team.length > 0 ? (
        <Section id="team-title" index="04" label="Команда" title="Специалисты" tone="paper">
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {team.map((person) => (
              <li key={person.name} className="border-t border-line py-7">
                <h3 className="text-[1.125rem]">{person.name}</h3>
                <p className="mt-1 text-muted">{person.position}</p>
                <ul className="mt-4 space-y-1.5 text-[0.9375rem]">
                  {person.credentials.map((credential) => (
                    <li key={credential}>{credential}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        id="details-title"
        index={team.length > 0 ? "05" : "04"}
        label="Сведения"
        title="Сведения об организации"
        tone={team.length > 0 ? "white" : "paper"}
        action={
          <Link href={legalDocuments.organization.href} className="text-link text-[0.9375rem]">
            Правовая информация
          </Link>
        }
      >
        <DetailsTable rows={organizationDetails()} />
      </Section>

      <CtaBand />
    </>
  );
}
