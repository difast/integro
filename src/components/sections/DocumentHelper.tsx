"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import {
  isComplete,
  kindExplanations,
  kindTitles,
  objectOptions,
  recommend,
  requestHref,
  steps,
  type Answers,
  type ResultKind,
} from "@/lib/document-helper";
import { buttonClass } from "@/components/ui/Button";

const otherKinds = (kind: ResultKind) =>
  (["report", "specialist", "court"] as const).filter((item) => item !== kind);

/**
 * Пошаговый опросник. Ответы живут только в состоянии компонента:
 * на сервер ничего не отправляется, пока пользователь сам не перейдёт к заявке.
 */
export function DocumentHelper() {
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Перенос фокуса на заголовок шага или результата — для клавиатуры и экранных дикторов.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stepIndex, showResult]);

  const step = steps[stepIndex]!;
  const options = step.options(answers);
  const selected = answers[step.key];

  const choose = (value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [step.key]: value } as Answers;
      // Варианты последнего вопроса зависят от цели: сбрасываем неподходящий ответ.
      if (step.key === "purpose" && next.object && !objectOptions(next.purpose).some((o) => o.value === next.object)) {
        delete next.object;
      }
      return next;
    });
  };

  const goNext = () => {
    if (!selected) return;
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
    else setShowResult(true);
  };

  const goBack = () => {
    if (showResult) setShowResult(false);
    else if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const restart = () => {
    setAnswers({});
    setStepIndex(0);
    setShowResult(false);
  };

  const editStep = (index: number) => {
    setShowResult(false);
    setStepIndex(index);
  };

  if (showResult && isComplete(answers)) {
    const result = recommend(answers);
    return (
      <div className="panel bg-white p-6 sm:p-10 lg:p-12" aria-live="polite">
        <p className="flex items-center gap-3 text-[0.875rem] font-medium text-muted">
          <span aria-hidden="true" className="h-[2px] w-8 bg-bronze" />
          Предварительный результат
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="h-section mt-4 outline-none">
          {result.kind === "consult" ? result.title : `Вероятно, подойдёт: ${result.title.toLowerCase()}`}
        </h2>
        {result.kind !== "consult" ? (
          <p className="lead mt-5 max-w-[48rem]">{kindExplanations[result.kind]}</p>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="min-w-0 space-y-8 lg:col-span-7">
            <section aria-labelledby="why-title">
              <h3 id="why-title" className="text-[1.125rem]">
                {result.kind === "consult" ? "Почему нужна консультация" : "Почему этот вариант"}
              </h3>
              <ul className="mt-4 space-y-3">
                {[...result.reasons, ...result.notes].map((text) => (
                  <li key={text} className="relative pl-6 text-body">
                    <span aria-hidden="true" className="absolute top-[0.8em] left-0 h-[2px] w-3 bg-bronze" />
                    {text}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="diff-title">
              <h3 id="diff-title" className="text-[1.125rem]">
                {result.kind === "consult" ? "Чем отличаются возможные варианты" : "Чем он отличается от других вариантов"}
              </h3>
              <dl className="mt-4 divide-y divide-line border-y border-line">
                {(result.kind === "consult" ? (["report", "specialist", "court"] as const) : otherKinds(result.kind)).map((kind) => (
                  <div key={kind} className="py-4">
                    <dt className="font-medium text-ink">{kindTitles[kind]}</dt>
                    <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">{kindExplanations[kind]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <div className="min-w-0 space-y-4 lg:col-span-5">
            <section aria-labelledby="prepare-title" className="rounded-[var(--radius-card)] bg-mist p-6">
              <h3 id="prepare-title" className="text-[1.0625rem]">
                Что желательно подготовить
              </h3>
              <ul className="mt-4 space-y-2.5">
                {result.prepare.map((item) => (
                  <li key={item} className="relative pl-6 text-[0.9375rem] text-body">
                    <span aria-hidden="true" className="absolute top-[0.75em] left-0 h-[2px] w-3 bg-bronze" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <div className="space-y-3 rounded-[var(--radius-card)] border border-line p-6">
              <Link href={requestHref(result, answers)} className={buttonClass("primary", "w-full")}>
                Перейти к заявке
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              {result.service ? (
                <Link href={result.service.href} className={buttonClass("outline", "w-full")}>
                  {result.service.label}
                </Link>
              ) : null}
              {result.lawyers ? (
                <Link href="/dlya-yuristov" className="block pt-1 text-center text-[0.9375rem] text-link">
                  Материалы для юристов: вопросы эксперту и шаблон ходатайства
                </Link>
              ) : null}
              <p className="pt-1 text-[0.8125rem] leading-relaxed text-muted">
                Ответы помощника не передаются нам. В заявке вы сами описываете ситуацию — рекомендация лишь отметит,
                с какого варианта вы начали.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-10 rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-mist px-4 py-3 text-[0.875rem] leading-relaxed text-ink">
          Это предварительная подсказка по общим правилам, а не юридическое заключение и не гарантия правильного выбора
          документа. Окончательно подходящий вариант определяется после изучения ситуации.
        </p>

        <section aria-labelledby="answers-title" className="mt-10 border-t border-line pt-6">
          <h3 id="answers-title" className="text-[0.9375rem] font-medium text-muted">
            Ваши ответы
          </h3>
          <ol className="mt-4 space-y-3">
            {steps.map((item, index) => {
              const option = item.options(answers).find((o) => o.value === answers[item.key]);
              return (
                <li key={item.key} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <span className="text-[0.9375rem] text-body">
                    <span className="text-muted">{item.title}</span> {option?.label}
                  </span>
                  <button type="button" onClick={() => editStep(index)} className="shrink-0 self-start text-[0.875rem] text-link">
                    Изменить<span className="sr-only">: {item.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={goBack} className={buttonClass("outline", "min-h-11 px-5")}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Назад
            </button>
            <button type="button" onClick={restart} className={buttonClass("outline", "min-h-11 px-5")}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Пройти заново
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <form
      className="panel bg-white p-6 sm:p-10 lg:p-12"
      onSubmit={(event) => {
        event.preventDefault();
        goNext();
      }}
    >
      {/* Индикатор прогресса */}
      <div>
        <p className="text-[0.875rem] font-medium text-muted" id="helper-progress">
          Вопрос {stepIndex + 1} из {steps.length}
        </p>
        <div
          role="progressbar"
          aria-labelledby="helper-progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={stepIndex + 1}
          className="mt-3 grid grid-cols-4 gap-1.5"
        >
          {steps.map((item, index) => (
            <span key={item.key} className={`h-1 rounded-full ${index <= stepIndex ? "bg-dark" : "bg-line"}`} />
          ))}
        </div>
      </div>

      <fieldset className="mt-8" aria-labelledby="helper-question">
        <h2 id="helper-question" ref={headingRef} tabIndex={-1} className="h-section outline-none">
          {step.title}
        </h2>
        {step.hint ? <p className="mt-3 text-[0.9375rem] text-muted">{step.hint}</p> : null}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const id = `${step.key}-${option.value}`;
            const checked = selected === option.value;
            return (
              <label
                key={option.value}
                htmlFor={id}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-dark sm:p-5 ${
                  checked ? "border-dark bg-mist" : "border-line hover:border-line-strong"
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name={step.key}
                  value={option.value}
                  checked={checked}
                  onChange={() => choose(option.value)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-dark)]"
                />
                <span className="text-[0.9375rem] leading-snug text-ink">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        {stepIndex > 0 ? (
          <button type="button" onClick={goBack} className={buttonClass("outline", "min-h-11 px-5")}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Назад
          </button>
        ) : null}
        <button type="submit" disabled={!selected} className={buttonClass("primary", "min-h-11 px-6")}>
          {stepIndex < steps.length - 1 ? "Далее" : "Показать результат"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
        {!selected ? <span className="text-[0.875rem] text-muted">Выберите один вариант</span> : null}
      </div>
    </form>
  );
}
