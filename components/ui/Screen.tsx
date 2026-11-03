/** Page frame: phone-width column, safe-area padding for notches and home indicators. */
export function Screen({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] ${className}`}
    >
      {children}
    </main>
  );
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <span className="size-6 animate-spin rounded-full border-2 border-go border-r-transparent" role="status" aria-label="Loading" />
    </div>
  );
}
