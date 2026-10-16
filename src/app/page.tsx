import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  FileSignature,
  Gavel,
  ListChecks,
  LockKeyhole,
  Scale,
  UserRound,
} from "lucide-react";
import { company } from "@/config/company";
import { audiences, clientLinks, legalFramework, principles } from "@/config/content";
import { services } from "@/config/services";
import { getSiteUrl, hasAnyContact } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { ContactList } from "@/components/ui/ContactList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { CtaBand } from "@/components/sections/CtaBand";
import { DocumentVisual } from "@/components/sections/DocumentVisual";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

export const metadata: Metadata = {
  alternates: getSiteUrl() ? { canonical: "/" } : undefined,
};

const quickActions = [
  { title: "Заказать оценку", note: "отчёт об оценке", href: "/kontakty?usluga=ocenka#zayavka", tone: "navy" },
  { title: "Судебная экспертиза", note: "по определению суда", href: "/uslugi/sudebnaya-ekspertiza", tone: "accent" },
  { title: "Порядок работы", note: "от обращения до результата", href: "/poryadok-raboty", tone: "accent" },
  { title: "Документы", note: "что подготовить", href: "/poryadok-raboty#dokumenty", tone: "accent" },
] as const;

const principleIcons = [Scale, ListChecks, FileSignature, LockKeyhole];

const audienceIcons = {
  person: UserRound,
  business: Building2,
  court: Gavel,
  lawyer: Briefcase,
};

export default function HomePage() {
  const [primaryService, ...otherServices] = services;

  return (
    <>
      {/* Первый экран: позиционирование, быстрые действия и колонка «Клиентам» */}
      <section className="border-b border-line">
        <div className="container-page grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="py-12 sm:py-16 lg:py-20 lg:pr-14">
            <p className="eyebrow animate-rise">{company.legalName}</p>
            <h1 className="mt-5 animate-rise text-[2.5rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-6xl lg:text-[4.4rem]">
              Оценка и судебная экспертиза
            </h1>
            <p className="mt-7 max-w-2xl animate-rise text-lg leading-relaxed text-muted [animation-delay:80ms] sm:text-xl">
              Определяем стоимость имущества и прав, проводим экспертизы по определению суда и внесудебные
              исследования для частных лиц, организаций и участников судебных процессов.
            </p>

            <nav aria-label="Быстрые действия" className="mt-10 animate-rise [animation-delay:160ms]">
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {quickActions.map((action) => (
                  <li key={action.href}>
                    <Link
                      href={action.href}
                      className={`group flex h-full min-h-[112px] flex-col justify-between rounded-2xl p-4 text-white transition-colors sm:p-5 ${
                        action.tone === "navy" ? "bg-navy-900 hover:bg-navy-800" : "bg-accent hover:bg-accent-hover"
                      }`}
                    >
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-5 w-5 self-end opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                      <span>
                        <span className="block text-[0.98rem] leading-tight font-bold sm:text-base">{action.title}</span>
                        <span className="mt-1 block text-xs text-white/75">{action.note}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <aside
            aria-label="Клиентам"
            className="border-t border-line py-10 lg:border-t-0 lg:border-l lg:py-20 lg:pl-10"
          >
            {hasAnyContact() ? (
              <div className="mb-10">
                <p className="eyebrow">Контакты</p>
                <ContactList size="lg" className="mt-5" />
              </div>
            ) : null}
            <p className="eyebrow">Клиентам</p>
            <ul className="mt-5 space-y-3.5">
              {clientLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link-underline text-lg font-semibold text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-2xl bg-paper p-6">
              <p className="font-bold text-ink">Планируете ходатайство о назначении экспертизы?</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Уточните заранее возможность проведения исследования, сроки и стоимость.
              </p>
              <Link
                href="/kontakty?usluga=sudebnaya-ekspertiza#zayavka"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:text-accent-hover"
              >
                Задать вопрос
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Правовая основа: схема документов + ключевые нормативные акты */}
      <section aria-labelledby="basis-title" className="container-page py-20 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="reveal mx-auto w-full max-w-[560px] lg:mx-0">
            <DocumentVisual />
          </div>
          <div>
            <h2
              id="basis-title"
              className="text-[2rem] leading-[1.1] font-extrabold tracking-[-0.025em] sm:text-[2.8rem]"
            >
              Результат, на который можно опереться в сделке и в суде
            </h2>
            <span className="rule mt-8" aria-hidden="true" />
            <p className="mt-8 text-lg leading-relaxed text-muted">
              Отчёт об оценке, заключение эксперта и заключение специалиста оформляются по требованиям закона и
              содержат описание методов, расчёты и обоснование выводов.
            </p>
            <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {legalFramework.map((item) => (
                <div key={item.code} className="reveal">
                  <dt className="text-2xl font-extrabold tracking-[-0.01em] text-ink">{item.code}</dt>
                  <dd className="mt-2 leading-relaxed text-muted">{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Направления деятельности */}
      <section aria-labelledby="services-title" className="bg-paper py-20 lg:py-28">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading
              id="services-title"
              eyebrow="Услуги"
              title={
                <>
                  Направления <span className="text-muted">деятельности</span>
                </>
              }
            />
            <ButtonLink href="/uslugi" variant="outline" className="self-start md:self-auto">
              Все услуги
            </ButtonLink>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-12">
            {primaryService ? (
              <Link
                href={`/uslugi/${primaryService.slug}`}
                className="reveal group relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] bg-navy-900 p-8 text-white lg:col-span-7 lg:row-span-2 lg:p-10"
              >
                <div
                  aria-hidden="true"
                  className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full border-[40px] border-white/[0.04]"
                />
                <ServiceIcon name={primaryService.icon} className="h-11 w-11 text-white/80" />
                <div className="relative">
                  <h3 className="text-[1.75rem] leading-tight font-extrabold text-white sm:text-[2.2rem]">
                    {primaryService.title}
                  </h3>
                  <p className="mt-4 max-w-xl text-lg leading-relaxed text-navy-200">{primaryService.summary}</p>
                  <span className="mt-8 inline-flex items-center gap-2 font-bold text-white">
                    Подробнее
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ) : null}

            {otherServices.map((service) => (
              <Link
                key={service.slug}
                href={`/uslugi/${service.slug}`}
                className="reveal group flex flex-col rounded-[var(--radius-card)] bg-white p-8 transition-shadow hover:shadow-[0_18px_50px_-24px_rgba(10,20,48,0.35)] lg:col-span-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <ServiceIcon name={service.icon} className="h-9 w-9 text-accent" />
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-5 w-5 text-muted transition-colors group-hover:text-accent"
                  />
                </div>
                <h3 className="mt-6 text-2xl font-extrabold">{service.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{service.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Кому помогаем */}
      <section aria-labelledby="audience-title" className="container-page py-20 lg:py-28">
        <SectionHeading
          id="audience-title"
          eyebrow="Заказчики"
          title="С кем мы работаем"
          lead="Порядок работы зависит от того, кто обращается и для чего нужен результат."
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((audience) => {
            const Icon = audienceIcons[audience.icon];
            return (
              <li key={audience.title} className="reveal rounded-[var(--radius-card)] border border-line p-7">
                <Icon aria-hidden="true" strokeWidth={1.6} className="h-8 w-8 text-navy-700" />
                <h3 className="mt-6 text-xl font-extrabold">{audience.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{audience.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Принципы работы */}
      <section aria-labelledby="principles-title" className="bg-paper py-20 lg:py-28">
        <div className="container-page">
          <SectionHeading
            id="principles-title"
            eyebrow="Подход"
            title={
              <>
                {company.shortName} — <span className="text-muted">принципы работы</span>
              </>
            }
          />
          <ul className="mt-12 grid gap-5 md:grid-cols-2">
            {principles.map((principle, index) => {
              const Icon = principleIcons[index] ?? Scale;
              return (
              <li
                key={principle.title}
                className={`reveal rounded-[var(--radius-card)] p-8 lg:p-10 ${
                  index === 0 ? "bg-navy-900 text-white" : "bg-white"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.6}
                  className={`h-8 w-8 ${index === 0 ? "text-white/70" : "text-accent"}`}
                />
                <h3 className={`mt-6 text-2xl font-extrabold ${index === 0 ? "text-white" : ""}`}>
                  {principle.title}
                </h3>
                <p className={`mt-3 text-lg leading-relaxed ${index === 0 ? "text-navy-200" : "text-muted"}`}>
                  {principle.text}
                </p>
              </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Порядок работы */}
      <section aria-labelledby="process-title" className="container-page pt-20 lg:pt-28">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading id="process-title" eyebrow="Порядок работы" title="От обращения до результата" />
          <ButtonLink href="/poryadok-raboty" variant="outline" className="self-start md:self-auto">
            Подробнее о порядке
          </ButtonLink>
        </div>
        <div className="mt-12">
          <ProcessSteps />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
