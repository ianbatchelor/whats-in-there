import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

type Variant = "go" | "ghost" | "ink" | "quiet" | "danger";

const styles: Record<Variant, string> = {
  go: "bg-go text-on-go",
  ghost: "bg-card text-fg ring-[1.5px] ring-inset ring-fg",
  ink: "bg-fg text-bg",
  quiet: "bg-transparent text-go",
  danger: "bg-transparent text-warn",
};

export function Button({
  variant = "go",
  busy = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-4 font-display text-[15px] font-bold whitespace-nowrap transition active:scale-[0.98] disabled:opacity-55 ${styles[variant]} ${className}`}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
