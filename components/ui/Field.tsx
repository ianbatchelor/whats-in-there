import { useId, type InputHTMLAttributes } from "react";

export function Field({
  label,
  hint,
  error,
  check,
  className = "",
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; check?: boolean }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-display text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-12 rounded-2xl border ${check ? "border-check-line bg-check" : "border-line bg-card"} px-4 text-base text-fg shadow-[inset_0_1px_2px_rgba(23,36,42,0.04)] placeholder:text-mute/80 focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none aria-[invalid]:border-warn`}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-warn">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
