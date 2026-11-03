export function Notice({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: React.ReactNode }) {
  const tones = {
    error: "border-warn/40 bg-warn/10 text-fg",
    info: "border-line bg-card text-fg",
    success: "border-go/40 bg-go/10 text-fg",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
