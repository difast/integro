import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { company } from "@/config/company";
import { principles } from "@/config/content";
import { legalDocuments } from "@/config/legal";
import { team } from "@/config/team";
import { pageMetadata } from "@/lib/metadata";
import { organizationDetails } from "@/lib/organization";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailsTable } from "@/components/ui/DetailsTable";
import { SectionHead } from "@/components/ui/SectionHead";
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

      {/* Организация: текст и тёмная карточка с ролью компании. */}
      <section aria-labelledby="company-title" className="container-page mt-20 lg:mt-24">
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="px-1 lg:col-span-7 lg:pr-10">
            <SectionHead id="company-title" eyebrow="Организация" title="Сторона договора и расчётов" />
            <div className="prose-text mt-8">
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
          <aside className="panel bg-dark p-8 text-white sm:p-10 lg:col-span-5">
            <p className="text-[0.875rem] text-on-dark">Итоговые документы</p>
            <ul className="mt-6 space-y-5">
              {signatories.map((s) => (
                <li key={s.document} className="flex items-center gap-4 text-[1.25rem] font-medium text-white">
                  <span aria-hidden="true" className="h-[2px] w-6 bg-bronze" />
                  {s.document}
                </li>
              ))}
            </ul>
            <Link href="/uslugi" className="mt-10 inline-flex items-center gap-2 text-[0.9375rem] text-white underline decoration-bronze underline-offset-4">
              Направления деятельности
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </section>

      {/* Принципы: белые карточки 2×2. */}
      <section aria-labelledby="principles-title" className="container-page mt-20 lg:mt-24">
        <SectionHead id="principles-title" eyebrow="Подход" title="Принципы работы" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {principles.map((principle) => (
            <li key={principle.title} className="surface p-7 sm:p-8">
              <span aria-hidden="true" className="block h-[2px] w-8 bg-bronze" />
              <h3 className="mt-5 text-[1.25rem]">{principle.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{principle.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Ответственность: список в белой панели. */}
      <section aria-labelledby="sign-title" className="container-page mt-20 lg:mt-24">
        <div className="panel bg-white px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <SectionHead
            id="sign-title"
            eyebrow="Ответственность"
            title="Кто подписывает итоговые документы"
            lead="Требования к лицам, подписывающим отчёты и заключения, установлены законом. Сведения о специалисте приводятся в самом документе."
          />
          <dl className="mt-10 divide-y divide-line border-y border-line">
            {signatories.map((item) => (
              <div key={item.document} className="grid gap-2 py-6 sm:grid-cols-[minmax(0,16rem)_1fr] sm:gap-10">
                <dt className="text-[1.0625rem] font-medium text-ink">{item.document}</dt>
                <dd className="max-w-[44rem] leading-relaxed text-muted">{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {team.length > 0 ? (
        <section aria-labelledby="team-title" className="container-page mt-20 lg:mt-24">
          <SectionHead id="team-title" eyebrow="Команда" title="Специалисты" />
          <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {team.map((person) => (
              <li key={person.name} className="surface p-7">
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
        </section>
      ) : null}

      {/* Сведения об организации. */}
      <section aria-labelledby="details-title" className="container-page mt-20 lg:mt-24">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHead id="details-title" eyebrow="Сведения" title="Сведения об организации" />
            <Link href={legalDocuments.organization.href} className="text-link mt-6 inline-block text-[0.9375rem]">
              Правовая информация
            </Link>
          </div>
          <div className="surface p-6 sm:p-8 lg:col-span-8">
            <DetailsTable rows={organizationDetails()} />
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
