import Link from "next/link";
import { company } from "@/config/company";

type LogoProps = {
  inverted?: boolean;
  className?: string;
};

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <rect width="40" height="40" rx="9" fill="#111f47" />
      <path
        d="M12.5 11v18M27.5 11v18M12.5 29 27.5 11"
        stroke="#fff"
        strokeWidth="3.6"
        strokeLinecap="square"
        fill="none"
      />
      <rect x="30" y="30" width="5" height="5" rx="1" fill="#b31d2e" />
    </svg>
  );
}

export function Logo({ inverted = false, className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-3 ${className}`}
      aria-label={`${company.legalName} — на главную`}
    >
      <LogoMark className="h-10 w-10 shrink-0" />
      <span className="flex flex-col leading-none">
        <span
          className={`text-[1.2rem] font-extrabold tracking-[0.14em] uppercase ${inverted ? "text-white" : "text-ink"}`}
        >
          {company.shortName}
        </span>
        <span
          className={`mt-1 text-[0.68rem] font-semibold tracking-[0.06em] whitespace-nowrap ${inverted ? "text-navy-200" : "text-muted"}`}
        >
          {company.tagline.toLowerCase()}
        </span>
      </span>
    </Link>
  );
}
