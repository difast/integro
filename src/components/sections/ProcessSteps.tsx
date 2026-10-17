import { processSteps } from "@/config/content";

/** Этапы работы: здесь нумерация действительно передаёт последовательность. */
export function ProcessSteps({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {processSteps.map((step, index) => (
        <li key={step.title} className="relative pt-8">
          <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-px ${dark ? "bg-white/15" : "bg-line-strong"}`} />
          <span aria-hidden="true" className="absolute top-0 left-0 h-[2px] w-10 bg-bronze" />
          <span className={`text-[2rem] leading-none font-light tabular-nums ${dark ? "text-bronze" : "text-steel"}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className={`mt-4 text-[1.125rem] ${dark ? "text-white" : ""}`}>{step.title}</h3>
          <p className={`mt-2 text-[0.9375rem] leading-relaxed ${dark ? "text-on-dark" : "text-muted"}`}>{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
