import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "outline" | "light" | "outline-light" | "bronze";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-[var(--radius-control)] px-6 py-3 text-[0.9375rem] font-medium leading-tight transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-dark text-white hover:bg-dark-800",
  outline: "border border-line-strong bg-transparent text-ink hover:border-dark",
  light: "bg-white text-ink hover:bg-mist",
  "outline-light": "border border-white/35 text-white hover:border-white",
  bronze: "bg-bronze text-dark hover:bg-bronze-deep hover:text-white",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({ variant = "primary", className = "", children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, className)} {...props}>
      {children}
    </Link>
  );
}
