/**
 * Схематичное изображение итоговых документов (отчёт об оценке и заключение
 * эксперта). Показывает, что получает заказчик, и заменяет фотографию, пока
 * собственные снимки компании не предоставлены.
 */

function Sheet({
  title,
  subtitle,
  rows,
  className = "",
}: {
  title: string;
  subtitle: string;
  rows: string[];
  className?: string;
}) {
  return (
    <div
      className={`absolute w-[78%] rounded-xl bg-white p-6 shadow-[0_24px_60px_-20px_rgba(10,20,48,0.45)] sm:p-8 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="h-2 w-16 rounded-full bg-navy-900" />
        <span className="h-2 w-8 rounded-full bg-accent" />
      </div>
      <p className="mt-8 text-[0.62rem] font-bold tracking-[0.2em] text-muted uppercase sm:text-xs">{subtitle}</p>
      <p className="mt-2 text-lg leading-tight font-extrabold text-ink sm:text-2xl">{title}</p>
      <ul className="mt-6 space-y-3">
        {rows.map((row, index) => (
          <li key={row} className="flex items-center gap-3">
            <span className="w-5 text-[0.65rem] font-bold text-accent tabular-nums">{String(index + 1).padStart(2, "0")}</span>
            <span className="truncate text-xs font-semibold text-body sm:text-sm">{row}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 space-y-2" aria-hidden="true">
        <span className="block h-1.5 w-full rounded-full bg-paper-strong" />
        <span className="block h-1.5 w-11/12 rounded-full bg-paper-strong" />
        <span className="block h-1.5 w-3/4 rounded-full bg-paper-strong" />
      </div>
    </div>
  );
}

export function DocumentVisual() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute top-0 left-0 h-[86%] w-[78%] bg-accent" />
      <div className="relative mt-8 ml-6 aspect-[4/4.1] overflow-hidden bg-navy-900 sm:mt-10 sm:ml-10" role="img" aria-label="Итоговые документы: отчёт об оценке и заключение эксперта">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <Sheet
          title="Заключение эксперта"
          subtitle="По определению суда"
          rows={["Вопросы суда", "Исследование", "Выводы"]}
          className="top-[4%] right-[5%] rotate-[4deg]"
        />
        <Sheet
          title="Отчёт об оценке"
          subtitle="135-ФЗ · ФСО"
          rows={["Задание на оценку", "Подходы и методы", "Итоговая стоимость"]}
          className="bottom-[4%] left-[6%] -rotate-[3deg]"
        />
      </div>
    </div>
  );
}
