import { channelLabels, type Channel } from "@/lib/chat/types";

const base = "inline-flex items-center rounded-full px-2.5 py-1 text-[0.8125rem] leading-none font-medium whitespace-nowrap";

export function DialogBadges({
  status,
  mode,
  needsReply,
  botBlocked,
  showMode = true,
}: {
  status: "open" | "closed";
  mode: "bot" | "operator";
  needsReply: boolean;
  botBlocked: boolean;
  /** В веб-чате бота нет — режим не показывается. */
  showMode?: boolean;
}) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {needsReply && status === "open" ? <span className={`${base} bg-dark text-white`}>Нужен ответ</span> : null}
      <span className={`${base} ${status === "open" ? "bg-bronze-soft text-ink" : "bg-mist text-muted"}`}>
        {status === "open" ? "В работе" : "Закрыт"}
      </span>
      {showMode ? <span className={`${base} border border-line-strong text-ink`}>{mode === "operator" ? "Оператор" : "Бот"}</span> : null}
      {botBlocked ? <span className={`${base} border border-danger text-danger`}>Бот остановлен клиентом</span> : null}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span
      className={`${base} ${
        channel === "telegram" ? "bg-[#e7f4fb] text-[#1b6f99]" : channel === "web" ? "bg-bronze-soft text-bronze-deep" : "bg-[#efeafe] text-[#5b3fd1]"
      }`}
    >
      {channelLabels[channel]}
    </span>
  );
}
