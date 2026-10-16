import { processSteps } from "@/config/content";

export function ProcessSteps() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {processSteps.map((step, index) => (
        <li key={step.title} className="reveal flex flex-col bg-white p-7 lg:p-8">
          <span className="text-sm font-extrabold tracking-[0.12em] text-accent tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-5 text-xl font-extrabold">{step.title}</h3>
          <p className="mt-3 leading-relaxed text-muted">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
