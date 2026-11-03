import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

type Variant = "go" | "gold" | "ghost" | "ink" | "quiet" | "danger";

export const buttonStyles: Record<Variant, string> = {
  go: "bg-go text-on-go shadow-[0_8px_20px_-12px_rgba(24,63,50,0.8)]",
  gold: "bg-tape text-on-tape shadow-[0_8px_20px_-12px_rgba(196,140,30,0.9)]",
  ghost: "bg-card text-fg ring-1 ring-inset ring-line",
  ink: "bg-fg text-bg",
  quiet: "bg-transparent text-leaf",
  danger: "bg-transparent text-warn",
};

export const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-5 font-display text-[15px] font-bold whitespace-nowrap transition active:scale-[0.98] disabled:opacity-55";

export function Button({
  variant = "go",
  busy = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button {...rest} disabled={disabled || busy} aria-busy={busy || undefined} className={`${buttonBase} ${buttonStyles[variant]} ${className}`}>
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
