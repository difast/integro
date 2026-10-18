import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { notForExpert, questionRules, questionSets } from "@/config/lawyers";
import { pageMetadata } from "@/lib/metadata";
import { proceedingKinds, proceedings } from "@/lib/petition";
import { breadcrumbJsonLd, JsonLd } from "@/lib/structured-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHead } from "@/components/ui/SectionHead";
import { PetitionBuilder } from "@/components/sections/PetitionBuilder";

export const metadata = pageMetadata({
  title: "Для юристов: вопросы эксперту и шаблон ходатайства",
  description:
    "Справочник для юристов и представителей: как подготовить вопросы эксперту, примеры вопросов по оценке и строительно-техническим исследованиям, шаблон ходатайства для ГПК, АПК и КАС, нормативная база.",
  path: "/dlya-yuristov",
});

const crumbs = [{ label: "Для юристов" }];

const toc = [
  { id: "kogda", label: "Когда нужна экспертиза" },
  { id: "voprosy", label: "Как подготовить вопросы" },
  { id: "primery-voprosov", label: "Примеры вопросов" },
  { id: "hodataystvo", label: "Как подготовить ходатайство" },
  { id: "shablon", label: "Шаблон ходатайства" },
  { id: "normy", label: "Нормативная база" },
  { id: "organizaciya", label: "Как предложить организацию" },
  { id: "obrashchenie", label: "Обращение в ООО «Интегро»" },
];

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="relative pl-6 text-body">
          <span aria-hidden="true" className="absolute top-[0.8em] left-0 h-[2px] w-3 bg-bronze" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function LawyersPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs, "/dlya-yuristov")} />
      <PageHeader
        title="Для юристов: вопросы эксперту и ходатайство о назначении экспертизы"
        crumbs={crumbs}
        lead="Практический справочник для юристов, адвокатов и представителей: как сформулировать вопросы эксперту, подготовить ходатайство и предложить суду экспертную организацию."
      >
        <p className="mt-5 max-w-[46rem] rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-mist px-4 py-3 text-[0.875rem] leading-relaxed text-ink">
          Материалы носят информационный характер и не являются юридической консультацией. Решение о назначении
          экспертизы, круг вопросов и выбор эксперта определяет суд.
        </p>
      </PageHeader>

      <div className="container-page mt-10 grid gap-8 lg:mt-14 lg:grid-cols-12">
        <nav aria-label="Содержание страницы" className="self-start rounded-[var(--radius-card)] bg-white p-6 lg:sticky lg:top-6 lg:col-span-3">
          <p className="text-[0.875rem] font-medium text-muted">Содержание</p>
          <ol className="mt-4 space-y-2.5 text-[0.9375rem]">
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-ink hover:text-bronze-deep">
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-16 lg:col-span-9">
          <section id="kogda" aria-labelledby="kogda-title" className="scroll-mt-6">
            <SectionHead id="kogda-title" eyebrow="Основания" title="Когда может потребоваться экспертиза" />
            <div className="prose-text mt-6 text-body">
              <p>
                Экспертиза назначается, когда для разрешения дела нужно установить обстоятельства, требующие специальных
                знаний в науке, технике, искусстве или ремесле. Типовые примеры — стоимость имущества или доли, размер
                ущерба, качество и объём строительных работ, причина повреждений, характер повреждений автомобиля.
              </p>
              <p>
                Если обстоятельство можно установить другими доказательствами — документами, показаниями, осмотром, —
                экспертиза может оказаться не нужна. Ходатайство стоит обосновать: какое обстоятельство важно для дела и
                почему без специальных знаний его не установить.
              </p>
              <p>
                По отдельным категориям дел судебные экспертизы проводятся исключительно государственными
                судебно-экспертными организациями. Перечень утверждён{" "}
                <a href="http://government.ru/docs/all/137446/" className="text-link" target="_blank" rel="noopener noreferrer">
                  распоряжением Правительства РФ от 16.11.2021 № 3214-р
                </a>
                . Перед тем как предлагать негосударственную организацию, проверьте, не относится ли дело к такой категории.
              </p>
            </div>
          </section>

          <section id="voprosy" aria-labelledby="voprosy-title" className="scroll-mt-6">
            <SectionHead id="voprosy-title" eyebrow="Вопросы" title="Как подготовить вопросы эксперту" />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {questionRules.map((rule) => (
                <li key={rule.title} className="surface p-6">
                  <span aria-hidden="true" className="block h-[2px] w-8 bg-bronze" />
                  <h3 className="mt-4 text-[1.0625rem]">{rule.title}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{rule.text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-[var(--radius-card)] bg-dark p-6 text-white sm:p-8">
              <h3 className="text-[1.0625rem] text-white">Какие вопросы эксперту не ставятся</h3>
              <p className="mt-2 text-[0.9375rem] text-on-dark">
                Вопросы права, виновности и юридической ответственности решает суд. Например:
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {notForExpert.map((item) => (
                  <li key={item} className="relative pl-6 text-[0.9375rem] text-on-dark">
                    <span aria-hidden="true" className="absolute top-[0.75em] left-0 h-[2px] w-3 bg-bronze" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="primery-voprosov" aria-labelledby="primery-title" className="scroll-mt-6">
            <SectionHead
              id="primery-title"
              eyebrow="Примеры"
              title="Примеры вопросов по направлениям"
              lead="Это примеры, а не готовые универсальные формулировки. Адаптируйте их к обстоятельствам дела, объекту, имеющимся материалам и компетенции эксперта."
            />
            <div className="mt-8 space-y-4">
              {questionSets.map((set) => (
                <article key={set.id} id={set.id} aria-labelledby={`${set.id}-title`} className="panel scroll-mt-6 bg-white p-6 sm:p-8">
                  <h3 id={`${set.id}-title`} className="text-[1.25rem]">
                    {set.title}
                  </h3>
                  <ol className="mt-5 space-y-3">
                    {set.questions.map((question, index) => (
                      <li key={question} className="flex gap-4 text-ink">
                        <span className="w-5 shrink-0 text-steel tabular-nums">{index + 1}.</span>
                        <span>{question}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-5 rounded-[var(--radius-control)] bg-mist px-4 py-3 text-[0.875rem] leading-relaxed text-body">
                    {set.note}
                  </p>
                  <Link href={set.service.href} className="mt-4 inline-flex items-center gap-1.5 text-[0.9375rem] text-link">
                    {set.service.label}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section id="hodataystvo" aria-labelledby="hodataystvo-title" className="scroll-mt-6">
            <SectionHead id="hodataystvo-title" eyebrow="Ходатайство" title="Как подготовить ходатайство о назначении экспертизы" />
            <Bullets
              items={[
                "Определите, какие обстоятельства подлежат установлению и почему для этого нужны специальные знания.",
                "Опишите объект исследования и материалы, которые можно предоставить эксперту; укажите, возможен ли осмотр.",
                "Сформулируйте вопросы — конкретно, в пределах специальных знаний, без вопросов права.",
                "Предложите экспертную организацию или эксперта и приложите сведения о них: возможность проведения, специальность и стаж экспертов, срок и стоимость.",
                "Учтите правила оплаты экспертизы по соответствующему кодексу: как правило, денежные суммы предварительно вносит сторона, заявившая ходатайство.",
                "Проверьте, не относится ли дело к категориям, по которым экспертизы проводят только государственные организации.",
              ]}
            />
          </section>

          <section id="shablon" aria-labelledby="shablon-title" className="scroll-mt-6">
            <SectionHead
              id="shablon-title"
              eyebrow="Шаблон"
              title="Редактируемый шаблон ходатайства"
              lead="Выберите вид судопроизводства и заполните поля — текст ходатайства формируется справа. Его можно скопировать, скачать или распечатать."
            />
            <p className="mt-6 rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-white px-4 py-3 text-[0.875rem] leading-relaxed text-ink">
              Шаблон — отправная точка. Он требует адаптации к обстоятельствам дела и не гарантирует удовлетворения
              ходатайства.
            </p>
            <div className="mt-6">
              <PetitionBuilder />
            </div>
          </section>

          <section id="normy" aria-labelledby="normy-title" className="scroll-mt-6">
            <SectionHead
              id="normy-title"
              eyebrow="Нормы"
              title="Нормативная база"
              lead="Перед подачей документа сверьте текст норм с действующей редакцией в справочной правовой системе или на официальном портале pravo.gov.ru."
            />
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {proceedingKinds.map((kind) => (
                <div key={kind} className="surface p-6">
                  <h3 className="text-[1.0625rem]">{proceedings[kind].label}</h3>
                  <ul className="mt-4 space-y-4">
                    {proceedings[kind].laws.map((law) => (
                      <li key={law.title} className="text-[0.9375rem]">
                        {law.href ? (
                          <a href={law.href} className="text-link" target="_blank" rel="noopener noreferrer">
                            {law.title}
                            <ExternalLink aria-hidden="true" className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />
                            <span className="sr-only"> (откроется в новой вкладке)</span>
                          </a>
                        ) : (
                          <span className="text-ink">{law.title}</span>
                        )}
                        <span className="mt-1 block text-[0.8125rem] text-muted">{law.note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[0.9375rem]">
              <a href="http://government.ru/docs/all/137446/" className="text-link" target="_blank" rel="noopener noreferrer">
                Распоряжение Правительства РФ от 16.11.2021 № 3214-р
                <ExternalLink aria-hidden="true" className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />
                <span className="sr-only"> (откроется в новой вкладке)</span>
              </a>{" "}
              <span className="text-muted">— перечень видов судебных экспертиз, проводимых исключительно государственными судебно-экспертными организациями.</span>
            </p>
          </section>

          <section id="organizaciya" aria-labelledby="organizaciya-title" className="scroll-mt-6">
            <SectionHead id="organizaciya-title" eyebrow="Выбор эксперта" title="Как предложить суду экспертную организацию" />
            <div className="prose-text mt-6 text-body">
              <p>
                В гражданском и арбитражном процессе право просить суд поручить экспертизу конкретному учреждению или
                эксперту прямо предусмотрено (ст. 79 ГПК РФ, ст. 82 АПК РФ); в административном процессе сверьтесь с
                нормами КАС РФ. Окончательный выбор делает суд: он может назначить другую организацию, в том числе
                предложенную другой стороной, или выбрать самостоятельно.
              </p>
              <p>
                Чтобы предложение было предметным, до заявления ходатайства запросите у организации письмо о
                возможности проведения экспертизы по предлагаемым вопросам. Как правило, в нём указывают, кто будет
                проводить исследование (специальность, образование, стаж), ориентировочные срок и стоимость.
              </p>
            </div>
          </section>

          <section id="obrashchenie" aria-labelledby="obrashchenie-title" className="scroll-mt-6">
            <div className="panel bg-dark p-6 text-white sm:p-10">
              <SectionHead id="obrashchenie-title" eyebrow="ООО «Интегро»" title="Уточнить возможность исследования" tone="dark" />
              <p className="mt-6 max-w-[42rem] text-[1.0625rem] leading-relaxed text-on-dark">
                Перед подачей ходатайства можно обратиться к нам, чтобы уточнить:
              </p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "подходит ли задача под компетенцию организации;",
                  "какие исходные материалы понадобятся;",
                  "возможно ли выполнить исследование по предлагаемым вопросам;",
                  "условия, стоимость и сроки.",
                ].map((item) => (
                  <li key={item} className="relative pl-6 text-on-dark">
                    <span aria-hidden="true" className="absolute top-[0.8em] left-0 h-[2px] w-3 bg-bronze" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-[42rem] text-[0.875rem] leading-relaxed text-on-dark">
                Обращение к нам не означает, что суд назначит экспертизу или поручит её нашей организации: эти решения
                принимает суд.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/kontakty?usluga=sudebnaya-ekspertiza#zayavka" variant="bronze">
                  Оставить заявку
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="/uslugi/sudebnaya-ekspertiza" variant="outline-light">
                  О судебной экспертизе
                </ButtonLink>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
