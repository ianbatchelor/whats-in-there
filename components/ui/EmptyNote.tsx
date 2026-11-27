/**
 * The same quiet card for every empty list: an icon, one short line on what to do next, and at
 * most one action.
 */
export function EmptyNote({
  Icon,
  children,
  action,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-[var(--radius-card)] border border-dashed border-line bg-card/60 px-4 py-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sage text-forest" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-[14.5px] leading-snug text-mute">{children}</div>
      {action}
    </div>
  );
}
