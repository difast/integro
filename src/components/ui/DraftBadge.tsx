/** Метка для формулировок, ожидающих подтверждения (видна только вне production). */
export function DraftBadge() {
  return (
    <span
      className="ml-2 inline-block rounded bg-bronze-soft px-1.5 py-0.5 align-middle text-[0.65rem] font-semibold tracking-wide text-bronze-deep uppercase"
      title="Требует подтверждения — см. CONTENT_TODO.md. В production скрыто."
    >
      черновик
    </span>
  );
}
