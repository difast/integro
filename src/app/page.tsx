import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { company } from "@/config/company";
import { audiences, principles } from "@/config/content";
import { services } from "@/config/services";
import { companyVideo } from "@/config/video";
import { getSiteUrl } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { CompanyVideo } from "@/components/sections/CompanyVideo";
import { CtaBand } from "@/components/sections/CtaBand";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

export const metadata: Metadata = {
  alternates: getSiteUrl() ? { canonical: "/" } : undefined,
};

const quickActions = [
  { title: "Заказать оценку", note: "отчёт об оценке", href: "/kontakty?usluga=ocenka#zayavka", tone: "navy" },
  { title: "Судебная экспертиза", note: "по определению суда", href: "/uslugi/sudebnaya-ekspertiza", tone: "accent" },
  { title: "Порядок работы", note: "от обращения до результата", href: "/poryadok-raboty", tone: "accent" },
  { title: "Документы", note: "что подготовить", href: "/poryadok-raboty#dokumenty", tone: "navy" },
] as const;

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="hero-title" className="border-b border-line">
        <div className="container-page grid gap-12 py-14 sm:py-20 lg:grid-cols-12 lg:gap-8 lg:py-24">
          <div className="lg:col-span-7 lg:pr-8">
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

          <nav aria-label="Быстрые действия" className="lg:col-span-5 lg:self-center">
            <ul className="grid grid-cols-2 gap-2 sm:gap-3">
              {quickActions.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className={`group flex aspect-[4/3] min-h-[128px] flex-col justify-between p-4 text-white transition-colors sm:p-5 ${
                      action.tone === "navy" ? "bg-navy-900 hover:bg-navy-800" : "bg-accent hover:bg-accent-hover"
                    }`}
                  >
                    <ArrowUpRight
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="h-5 w-5 self-end opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                    <span>
                      <span className="block text-[1rem] leading-snug font-semibold sm:text-[1.0625rem]">{action.title}</span>
                      <span className="mt-1 block text-[0.8125rem] text-white/75">{action.note}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
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

      <section aria-labelledby="video-title" className="bg-navy-900 text-white">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
          <div className="lg:col-span-7">
            <CompanyVideo
              title={companyVideo.title}
              webm={companyVideo.webm}
              mp4={companyVideo.mp4}
              poster={companyVideo.poster}
              width={companyVideo.width}
              height={companyVideo.height}
              hasAudio={companyVideo.hasAudio}
            />
          </div>
          <div className="lg:col-span-5">
            <p className="label text-navy-300">О компании за минуту</p>
            <h2 id="video-title" className="h-section mt-5 text-white">
              Как «Интегро» помогает разобраться в вашем вопросе
            </h2>
            <p className="mt-5 text-[1.0625rem] leading-relaxed text-navy-300">
              С какими задачами к нам обращаются и как устроена работа — от заявки до готового отчёта или
              заключения.
            </p>
            <div className="mt-8">
              <ButtonLink href="/kontakty#zayavka" variant="light">
                Оставить заявку
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </ButtonLink>
            </div>
            <details className="group mt-8 border-t border-white/15 pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[0.9375rem] font-medium text-white [&::-webkit-details-marker]:hidden">
                Текст ролика
                <span aria-hidden="true" className="text-navy-300 group-open:hidden">
                  +
                </span>
                <span aria-hidden="true" className="hidden text-navy-300 group-open:inline">
                  −
                </span>
              </summary>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-navy-300">
                {companyVideo.transcript.cues.map((cue) => cue.text).join(" ")}
              </p>
            </details>
          </div>
        </div>
      </section>

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
