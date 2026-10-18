import { statusLabel } from "@/lib/requests/statuses";

const styles: Record<string, string> = {
  new: "bg-dark text-white",
  in_progress: "bg-bronze-soft text-ink",
  waiting_client: "border border-bronze text-ink",
  done: "bg-mist text-muted",
  rejected: "border border-line-strong text-muted",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.8125rem] leading-none font-medium whitespace-nowrap ${styles[status] ?? "bg-mist text-ink"}`}
    >
      {statusLabel(status)}
    </span>
  );
}
