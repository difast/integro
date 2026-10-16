import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "navy" | "outline" | "outline-light" | "ghost-light";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[0.95rem] font-bold leading-tight transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  navy: "bg-navy-900 text-white hover:bg-navy-800",
  outline: "border-2 border-navy-900/15 text-ink hover:border-navy-900/40",
  "outline-light": "border-2 border-white/25 text-white hover:border-white/60",
  "ghost-light": "bg-white text-ink hover:bg-navy-100",
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
