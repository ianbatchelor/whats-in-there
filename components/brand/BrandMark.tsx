/** App mark: an appliance door with its handle and a strip of tape. */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center bg-gradient-to-br from-[#17404b] to-[#0b2128] ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.23 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={size * 0.62} height={size * 0.62}>
        <rect x="13" y="6" width="38" height="52" rx="8" fill="none" stroke="#EAF2F3" strokeWidth="4.5" />
        <path d="M13 24h38" stroke="#EAF2F3" strokeWidth="4.5" />
        <path d="M43 12v6" stroke="#EAF2F3" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M18 33.5 44 30.2l.9 8.6-26 3.3z" fill="#F5C84C" />
      </svg>
    </span>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      What&apos;s in There<span className="text-[#b98a12] dark:text-tape">?</span>
    </span>
  );
}
