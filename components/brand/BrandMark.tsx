/** App mark: an open box with light coming out of it. "Make the invisible visible." */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center bg-[#183f32] ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={size * 0.7} height={size * 0.7} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 6v7M17 10l3.5 6M47 10l-3.5 6M9 21l6 3M55 21l-6 3" stroke="#f6c65b" strokeWidth="3.4" />
        <path d="M14 30 32 23l18 7-18 7z" fill="#f6c65b" fillOpacity="0.22" stroke="#f6c65b" strokeWidth="3.4" />
        <path d="M14 30v17l18 8 18-8V30M32 37v18" stroke="#f6c65b" strokeWidth="3.4" />
      </svg>
    </span>
  );
}

/** The name. Inside the app it uses the heading face; the public pages pass `serif` for the editorial look. */
export function Wordmark({ className = "", serif = false }: { className?: string; serif?: boolean }) {
  return <span className={`${serif ? "font-serif" : "font-display"} font-bold tracking-[-0.01em] whitespace-nowrap ${className}`}>See What&apos;s in Here</span>;
}
