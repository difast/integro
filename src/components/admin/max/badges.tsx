const base = "inline-flex items-center rounded-full px-2.5 py-1 text-[0.8125rem] leading-none font-medium whitespace-nowrap";

export function DialogBadges({
  status,
  mode,
  needsReply,
  botBlocked,
}: {
  status: "open" | "closed";
  mode: "bot" | "operator";
  needsReply: boolean;
  botBlocked: boolean;
}) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {needsReply && status === "open" ? <span className={`${base} bg-dark text-white`}>Нужен ответ</span> : null}
      <span className={`${base} ${status === "open" ? "bg-bronze-soft text-ink" : "bg-mist text-muted"}`}>
        {status === "open" ? "В работе" : "Закрыт"}
      </span>
      <span className={`${base} border border-line-strong text-ink`}>{mode === "operator" ? "Оператор" : "Бот"}</span>
      {botBlocked ? <span className={`${base} border border-danger text-danger`}>Бот остановлен клиентом</span> : null}
    </span>
  );
}
