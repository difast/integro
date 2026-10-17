/**
 * Визуальная часть первого экрана: тёмная панель со скошенным краем
 * (композиция референса) и стопка итоговых документов компании.
 * Показывает, что получает заказчик, а не служит украшением.
 */
const docs = [
  { title: "Заключение специалиста", tag: "Исследование", rotate: "-rotate-[7deg]", pos: "left-[4%] top-[26%]" },
  { title: "Заключение эксперта", tag: "По определению суда", rotate: "rotate-[5deg]", pos: "right-[4%] top-[8%]" },
  { title: "Отчёт об оценке", tag: "135-ФЗ · ФСО", rotate: "-rotate-[1.5deg]", pos: "left-[26%] top-[42%]" },
];

function Doc({ title, tag, className }: { title: string; tag: string; className: string }) {
  return (
    <div
      className={`absolute w-[52%] rounded-[12px] bg-white p-4 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.55)] sm:p-5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="h-1.5 w-12 rounded-full bg-dark" />
        <span className="h-1.5 w-6 rounded-full bg-bronze" />
      </div>
      <p className="mt-5 truncate text-[0.625rem] font-medium tracking-[0.12em] text-muted uppercase sm:text-[0.6875rem]">{tag}</p>
      <p className="mt-1.5 text-[0.9375rem] leading-tight font-semibold text-ink sm:text-[1.0625rem]">{title}</p>
      <div className="mt-4 space-y-2" aria-hidden="true">
        <span className="block h-1.5 w-full rounded-full bg-mist" />
        <span className="block h-1.5 w-11/12 rounded-full bg-mist" />
        <span className="block h-1.5 w-3/4 rounded-full bg-mist" />
        <span className="block h-1.5 w-5/6 rounded-full bg-mist" />
      </div>
      <span className="mt-5 block h-[2px] w-14 bg-bronze" aria-hidden="true" />
    </div>
  );
}

export function HeroVisual() {
  return (
    <div
      role="img"
      aria-label="Итоговые документы: отчёт об оценке, заключение эксперта, заключение специалиста"
      className="relative h-full min-h-[300px] overflow-hidden rounded-[var(--radius-card)] bg-dark sm:min-h-[380px] lg:[clip-path:polygon(16%_0,100%_0,100%_100%,0_100%)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div aria-hidden="true" className="absolute -right-16 -bottom-24 h-72 w-72 rounded-full border border-bronze/40" />
      <div className="absolute inset-0 lg:left-[12%]">
        {docs.map((d) => (
          <Doc key={d.title} title={d.title} tag={d.tag} className={`${d.rotate} ${d.pos}`} />
        ))}
      </div>
    </div>
  );
}
