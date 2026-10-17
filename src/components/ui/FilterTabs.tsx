"use client";

type Tab = { key: string; label: string; count?: number };

/** Вкладки-фильтр в стиле сайта: подчёркнутая активная вкладка. */
export function FilterTabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max border-b border-line-strong/60">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(tab.key)}
              className={`relative -mb-px border-b-2 px-1 py-3.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors not-last:mr-8 ${
                isActive ? "border-bronze text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab.label}
              {typeof tab.count === "number" ? <span className="ml-1.5 text-muted tabular-nums">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
