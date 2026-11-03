import { useId, type InputHTMLAttributes } from "react";

export function Field({
  label,
  hint,
  error,
  className = "",
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-12 rounded-xl border border-line bg-card px-3.5 text-base text-fg placeholder:text-mute focus:border-go focus:outline-none aria-[invalid]:border-warn"
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
