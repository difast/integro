import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbJsonLd, JsonLd } from "@/lib/structured-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { DocumentHelper } from "@/components/sections/DocumentHelper";
import { SectionHead } from "@/components/ui/SectionHead";
import { kindExplanations, kindTitles } from "@/lib/document-helper";

export const metadata = pageMetadata({
  title: "Какой документ мне нужен: помощник по выбору",
  description:
    "Ответьте на четыре вопроса и узнайте, с чего начать: отчёт об оценке, заключение специалиста или судебная экспертиза. Предварительная подсказка без регистрации и сбора данных.",
  path: "/kakoy-dokument-nuzhen",
});

const crumbs = [{ label: "Какой документ мне нужен" }];

export default function DocumentHelperPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs, "/kakoy-dokument-nuzhen")} />
      <PageHeader
        title="Какой документ мне нужен?"
        crumbs={crumbs}
        lead="Ответьте на несколько вопросов, чтобы понять, с чего начать."
      >
        <p className="mt-4 max-w-[46rem] text-[0.9375rem] leading-relaxed text-muted">
          Четыре вопроса, без регистрации. Ответы не отправляются на сервер — результат рассчитывается в вашем браузере.
        </p>
      </PageHeader>

      <section aria-label="Опросник" className="container-page mt-4">
        <DocumentHelper />
      </section>

      <section aria-labelledby="kinds-title" className="container-page mt-20 lg:mt-24">
        <SectionHead
          id="kinds-title"
          eyebrow="Справка"
          title="Три варианта и чем они различаются"
          lead="Коротко о документах, между которыми чаще всего выбирают."
        />
        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {(["report", "specialist", "court"] as const).map((kind) => (
            <li key={kind} className="surface p-6 sm:p-7">
              <span aria-hidden="true" className="block h-[2px] w-8 bg-bronze" />
              <h3 className="mt-5 text-[1.1875rem]">{kindTitles[kind]}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{kindExplanations[kind]}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[0.9375rem] text-muted">
          Подробнее о различиях — в статье{" "}
          <Link href="/stati/otchet-ob-ocenke-i-zaklyuchenie-eksperta" className="text-link">
            «Отчёт об оценке и заключение эксперта: в чём разница»
          </Link>
          .
        </p>
      </section>
    </>
  );
}
