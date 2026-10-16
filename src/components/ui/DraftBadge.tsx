/** Метка для формулировок, ожидающих подтверждения (видна только вне production). */
export function DraftBadge() {
  return (
    <span
      className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[0.65rem] font-bold tracking-wide text-amber-900 uppercase"
      title="Требует подтверждения — см. CONTENT_TODO.md. В production скрыто."
    >
      черновик
    </span>
  );
}
