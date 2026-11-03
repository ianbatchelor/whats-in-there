"use client";

/** Big − / + buttons for counted things. Halves are allowed when step is 0.5. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="Fewer"
        className="grid size-12 place-items-center rounded-xl border border-line bg-card font-display text-2xl font-bold disabled:opacity-40"
      >
        −
      </button>
      <output aria-live="polite" className="min-w-16 flex-1 text-center font-display text-3xl font-extrabold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label="More"
        className="grid size-12 place-items-center rounded-xl border border-line bg-card font-display text-2xl font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
