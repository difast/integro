import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { audiences, principles } from "@/config/content";
import { audienceLabels } from "@/config/service-details";
import { services } from "@/config/services";
import { companyVideo } from "@/config/video";
import { articleCategories, getArticles } from "@/lib/articles";
import { getSiteUrl } from "@/lib/site";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { ButtonLink } from "@/components/ui/Button";
import { ScrollItem, ScrollRow } from "@/components/ui/ScrollRow";
import { SectionHead } from "@/components/ui/SectionHead";
import { CompanyVideo } from "@/components/sections/CompanyVideo";
import { CtaBand } from "@/components/sections/CtaBand";
import { HeroVisual } from "@/components/sections/HeroVisual";
import { ProcessSteps } from "@/components/sections/ProcessSteps";

export const metadata: Metadata = {
  alternates: getSiteUrl() ? { canonical: "/" } : undefined,
};

/** Быстрые переходы под первым экраном (полоса вкладок, как в референсе). */
const quickActions = [
  { title: "Заказать оценку", note: "Отчёт об оценке", href: "/kontakty?usluga=ocenka#zayavka" },
  { title: "Судебная экспертиза", note: "По определению суда", href: "/uslugi/sudebnaya-ekspertiza" },
  { title: "Экспертные исследования", note: "Заключение специалиста", href: "/uslugi/ekspertnye-issledovaniya" },
  { title: "Какой документ нужен?", note: "Помощник: четыре вопроса", href: "/kakoy-dokument-nuzhen" },
];

export default function HomePage() {
  const articles = getArticles()
    .slice(0, 6)
    .map((a) => ({ ...a, categoryLabel: articleCategories[a.category] }));

  return (
    <>
      {/* Первый экран: панель с текстом слева, визуалом справа и полосой быстрых переходов снизу. */}
      <section aria-labelledby="hero-title" className="container-page pt-6 sm:pt-8">
        <div className="panel bg-white p-4 sm:p-6 lg:p-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
            <div className="px-2 pt-6 pb-2 sm:px-4 lg:col-span-6 lg:py-14 lg:pl-6">
              <p className="text-[0.9375rem] text-muted">Оценочная и экспертная деятельность</p>
              <h1
                id="hero-title"
                className="mt-5 text-[2.25rem] leading-[1.1] tracking-[-0.02em] sm:text-[2.875rem] lg:text-[3.125rem]"
              >
                Оценка имущества и&nbsp;судебная экспертиза
              </h1>
              <p className="mt-5 text-[1.375rem] leading-snug text-ink sm:text-[1.625rem]">
                Документы с <span className="text-bronze-deep">обоснованными выводами</span> — для сделки, переговоров
                и суда
              </p>
              <p className="mt-5 max-w-[32rem] text-[1rem] leading-relaxed text-muted">
                Отчёты об оценке, заключения эксперта и специалиста с расчётами, описанием методов и ссылками на
                источники.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <ButtonLink href="/kontakty#zayavka" className="px-7">
                  Оставить заявку
                </ButtonLink>
                <Link href="/uslugi" className="text-link inline-flex items-center gap-2 text-[0.9375rem]">
                  Все услуги
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
              <ul className="mt-9 flex flex-wrap gap-2" aria-label="Кому подходят услуги">
                {Object.entries(audienceLabels).map(([key, label]) => (
                  <li key={key}>
                    <Link
                      href={`/uslugi?dlya=${key}`}
                      className="inline-flex rounded-full bg-mist px-3.5 py-1.5 text-[0.8125rem] text-body transition-colors hover:bg-mist-deep hover:text-ink"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-6">
              <HeroVisual />
            </div>
          </div>

          <nav aria-label="Быстрые переходы" className="mt-4 sm:mt-6">
            <ul className="grid overflow-hidden rounded-[var(--radius-card)] bg-mist sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action) => (
                <li key={action.href} className="border-line-strong/50 not-last:border-b sm:not-last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:not-last:border-r lg:[&:nth-child(odd)]:border-r">
                  <Link
                    href={action.href}
                    className="group relative flex h-full items-start justify-between gap-4 px-5 py-5 transition-colors hover:bg-white sm:px-6 sm:py-6"
                  >
                    <span>
                      <span className="block font-medium text-ink">{action.title}</span>
                      <span className="mt-1 block text-[0.875rem] text-muted">{action.note}</span>
                    </span>
                    <ArrowUpRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-steel group-hover:text-ink" />
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-5 bottom-0 h-[3px] origin-left scale-x-0 bg-bronze transition-transform group-hover:scale-x-100 sm:inset-x-6"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/* Направления: асимметричная композиция — заголовок слева, список услуг справа. */}
      <section aria-labelledby="services-title" className="container-page mt-20 lg:mt-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-10">
              <SectionHead
                id="services-title"
                eyebrow="Услуги"
                title="Три направления — три итоговых документа"
                lead="Выбор зависит от задачи: сделка, спор с другой стороной или судебный процесс."
              />
              <ButtonLink href="/uslugi" variant="outline" className="mt-8">
                Все услуги
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </ButtonLink>
            </div>
          </div>
          <ul className="space-y-4 lg:col-span-8">
            {services.map((service) => (
              <li key={service.slug}>
                <Link
                  href={`/uslugi/${service.slug}`}
                  className="group grid gap-6 rounded-[var(--radius-card)] bg-white p-6 transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(38,55,70,0.5)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"
                >
                  <div>
                    <h3 className="text-[1.375rem] leading-snug sm:text-[1.5rem]">{service.title}</h3>
                    <p className="mt-3 max-w-[36rem] text-[0.9375rem] leading-relaxed text-muted">{service.summary}</p>
                    <p className="mt-5 inline-flex items-center gap-2 text-[0.875rem] text-body">
                      <span aria-hidden="true" className="h-[2px] w-5 bg-bronze" />
                      {service.result.title}
                    </p>
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-mist text-ink transition-colors group-hover:bg-dark group-hover:text-white">
                    <ArrowRight aria-hidden="true" className="h-5 w-5" />
                    <span className="sr-only">Подробнее об услуге «{service.title}»</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-20 lg:mt-28">
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
      </div>

      {/* Порядок работы: белая панель с этапами. */}
      <section aria-labelledby="process-title" className="container-page mt-20 lg:mt-28">
        <div className="panel bg-white px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <SectionHead
            id="process-title"
            eyebrow="Порядок работы"
            title="От обращения до результата"
            lead="Условия согласуются до начала работы. Для судебной экспертизы основанием служит определение суда."
            action={
              <Link href="/poryadok-raboty" className="text-link inline-flex items-center gap-2 text-[0.9375rem]">
                Подробнее о порядке
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            }
          />
          <div className="mt-12">
            <ProcessSteps />
          </div>
        </div>
      </section>

      {/* Подход: крупный типографический акцент и список принципов. */}
      <section aria-labelledby="principles-title" className="container-page mt-20 lg:mt-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="flex items-center gap-3 text-[0.875rem] font-medium text-muted">
              <span aria-hidden="true" className="h-[2px] w-8 bg-bronze" />
              Подход
            </p>
            <h2 id="principles-title" className="mt-4 text-[2rem] leading-[1.15] tracking-[-0.015em] sm:text-[2.75rem]">
              Выводы, которые можно проверить
            </h2>
            <p className="mt-6 max-w-[28rem] text-[1.0625rem] leading-relaxed text-muted">
              Работаем в порядке, установленном законом, а условия фиксируем до начала работы.
            </p>
          </div>
          <dl className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:col-span-6 lg:col-start-7 lg:pt-12">
            {principles.map((p) => (
              <div key={p.title} className="border-t border-line-strong pt-5">
                <dt className="font-medium text-ink">{p.title}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{p.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Заказчики: карточки разных пропорций. */}
      <section aria-labelledby="audience-title" className="container-page mt-20 lg:mt-28">
        <SectionHead
          id="audience-title"
          eyebrow="Заказчики"
          title="С кем мы работаем"
          lead="Порядок работы зависит от того, кто обращается и для чего нужен результат."
        />
        <ul className="mt-10 grid gap-4 md:grid-cols-6">
          {audiences.map((audience, index) => (
            <li
              key={audience.title}
              className={`rounded-[var(--radius-card)] p-7 ${
                index === 0 ? "bg-dark text-white md:col-span-4" : index === 3 ? "bg-white md:col-span-4" : "bg-white md:col-span-2"
              }`}
            >
              <h3 className={`text-[1.25rem] ${index === 0 ? "text-white" : ""}`}>{audience.title}</h3>
              <p className={`mt-3 max-w-[32rem] leading-relaxed ${index === 0 ? "text-on-dark" : "text-muted"}`}>
                {audience.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {articles.length > 0 ? (
        <section aria-labelledby="articles-title" className="container-page mt-20 lg:mt-28">
          <SectionHead
            id="articles-title"
            eyebrow="Статьи"
            title="Полезные материалы"
            lead="Разбираем вопросы, которые возникают у заказчиков оценки и участников судебных споров."
            action={
              <ButtonLink href="/stati" variant="outline">
                Все статьи
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </ButtonLink>
            }
          />
          <div className="mt-10">
            <ScrollRow label="Статьи">
              {articles.map((article, index) => (
                <ScrollItem key={article.slug}>
                  <ArticleCard article={article} tone={index === 0 ? "dark" : "light"} />
                </ScrollItem>
              ))}
            </ScrollRow>
          </div>
        </section>
      ) : null}

      <CtaBand />
    </>
  );
}
