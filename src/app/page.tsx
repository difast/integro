import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { company } from "@/config/company";
import { audiences, principles } from "@/config/content";
import { legalDocuments } from "@/config/legal";
import { services } from "@/config/services";
import { organizationDetails } from "@/lib/organization";
import { getSiteUrl } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { CtaBand } from "@/components/sections/CtaBand";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

export const metadata: Metadata = {
  alternates: getSiteUrl() ? { canonical: "/" } : undefined,
};

const heroDetails = ["ОГРН", "ИНН", "Юридический адрес", "Часы связи"];

export default function HomePage() {
  const details = organizationDetails().filter((row) => heroDetails.includes(row.label));

  return (
    <>
      <section aria-labelledby="hero-title" className="border-b border-line">
        <div className="container-page grid gap-12 py-14 sm:py-20 lg:grid-cols-12 lg:gap-8 lg:py-24">
          <div className="lg:col-span-8 lg:pr-8">
            <p className="label">
              <span className="label-index">—</span>
              {company.legalName}
            </p>
            <h1
              id="hero-title"
              className="mt-6 text-[2.375rem] leading-[1.08] tracking-[-0.02em] sm:text-[3.25rem] lg:text-[3.75rem]"
            >
              Оценка имущества и судебная экспертиза
            </h1>
            <p className="lead mt-7 max-w-[40rem]">
              Определяем стоимость имущества и прав, проводим экспертизы по определению суда и внесудебные
              исследования для частных лиц, организаций и участников судебных процессов.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/kontakty#zayavka">
                Оставить заявку
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/uslugi" variant="outline">
                Направления деятельности
              </ButtonLink>
            </div>
          </div>

          <aside aria-labelledby="hero-details" className="lg:col-span-4 lg:border-l lg:border-line lg:pl-8">
            <h2 id="hero-details" className="label">
              Сведения об организации
            </h2>
            <dl className="mt-5 border-t border-line">
              {details.map((row) => (
                <div key={row.label} className="border-b border-line py-3.5">
                  <dt className="text-[0.8125rem] text-muted">{row.label}</dt>
                  <dd className="mt-0.5 text-[0.9375rem] font-medium text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
            <Link href={legalDocuments.organization.href} className="text-link mt-5 inline-block text-[0.9375rem]">
              Все сведения
            </Link>
          </aside>
        </div>
      </section>

      <Section
        id="services-title"
        index="01"
        label="Услуги"
        title="Направления деятельности"
        action={
          <Link href="/uslugi" className="text-link text-[0.9375rem]">
            Все услуги
          </Link>
        }
      >
        <ul className="grid border-t border-line md:grid-cols-3">
          {services.map((service, index) => (
            <li
              key={service.slug}
              className="border-b border-line md:border-b-0 md:border-l md:first:border-l-0 md:[&:not(:first-child)]:pl-6 md:[&:not(:last-child)]:pr-6"
            >
              <Link href={`/uslugi/${service.slug}`} className="group flex h-full flex-col py-7">
                <span className="text-[0.875rem] font-medium text-accent tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-[1.25rem] leading-snug group-hover:underline group-hover:decoration-accent group-hover:underline-offset-[5px]">
                  {service.title}
                </h3>
                <p className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-muted">{service.summary}</p>
                <p className="mt-6 text-[0.875rem] text-muted">
                  Итоговый документ: <span className="font-medium text-ink">{service.result.title}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="process-title"
        index="02"
        label="Порядок работы"
        title="От обращения до результата"
        lead="Условия согласуются до начала работы. Для судебной экспертизы основанием служит определение суда."
        tone="paper"
        action={
          <Link href="/poryadok-raboty" className="text-link text-[0.9375rem]">
            Подробнее о порядке
          </Link>
        }
      >
        <ProcessSteps />
      </Section>

      <Section id="principles-title" index="03" label="Подход" title="Принципы работы">
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {principles.map((principle) => (
            <li key={principle.title} className="border-t border-line py-7">
              <h3 className="text-[1.125rem]">{principle.title}</h3>
              <p className="mt-3 text-muted">{principle.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="audience-title"
        index="04"
        label="Заказчики"
        title="С кем мы работаем"
        lead="Порядок работы зависит от того, кто обращается и для чего нужен результат."
        tone="paper"
      >
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {audiences.map((audience) => (
            <li key={audience.title} className="border-t border-line py-7">
              <h3 className="text-[1.125rem]">{audience.title}</h3>
              <p className="mt-3 text-muted">{audience.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand />
    </>
  );
}
