import type { DetailRow } from "@/lib/organization";

/** Таблица «название — значение» для реквизитов и официальных сведений. */
export function DetailsTable({ rows, compact = false }: { rows: DetailRow[]; compact?: boolean }) {
  return (
    <dl className="border-t border-line">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`grid gap-1 border-b border-line ${compact ? "py-3" : "py-4 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8"}`}
        >
          <dt className="text-[0.875rem] text-muted">{row.label}</dt>
          <dd className="font-medium break-words text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
