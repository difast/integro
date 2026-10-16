import { processSteps } from "@/config/content";

export function ProcessSteps() {
  return (
    <ol className="border-t border-line">
      {processSteps.map((step, index) => (
        <li
          key={step.title}
          className="grid gap-2 border-b border-line py-6 sm:grid-cols-[4rem_minmax(0,14rem)_1fr] sm:gap-6 lg:py-7"
        >
          <span className="text-[0.875rem] font-medium text-accent tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-[1.0625rem] leading-snug">{step.title}</h3>
          <p className="max-w-[40rem] text-muted">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
