import Image from "next/image";
import Link from "next/link";
import { company } from "@/config/company";

type LogoProps = {
  inverted?: boolean;
  className?: string;
};

/** Знак компании (исходник — assets/brand/logo-source.jpeg). */
export function LogoMark({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <Image
      src={light ? "/brand/logo-mark-light.png" : "/brand/logo-mark.png"}
      alt=""
      width={278}
      height={288}
      className={className}
    />
  );
}

export function Logo({ inverted = false, className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-3 ${className}`}
      aria-label={`${company.legalName} — на главную`}
    >
      <LogoMark className="h-10 w-auto shrink-0" light={inverted} />
      <span className="flex flex-col leading-none">
        <span
          className={`text-[1.125rem] font-semibold tracking-[0.14em] uppercase ${inverted ? "text-white" : "text-ink"}`}
        >
          {company.shortName}
        </span>
        <span
          className={`mt-1.5 text-[0.6875rem] font-normal tracking-[0.04em] whitespace-nowrap ${inverted ? "text-on-dark" : "text-muted"}`}
        >
          {company.tagline.toLowerCase()}
        </span>
      </span>
    </Link>
  );
}
