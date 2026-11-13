import type { Wrap, WishIdea } from "@/lib/domain/presents";
import { linkLabel } from "@/lib/domain/presents";
import { IconCheck, IconLink, IconStar } from "@/components/ui/icons";
import { wishPictureUrl } from "@/lib/presents";

export type ClaimView = { byMe: boolean; name: string; fromLink: boolean };

/**
 * One idea as a gift tag: a punched tag edge in the person's wrapping colour, then the idea, its
 * note, price and shop. On someone else's list, a button to say you're getting it.
 */
export function IdeaRow({
  idea,
  wrap,
  mine,
  busy,
  addedBy,
  claim,
  onClaim,
  onUnclaim,
  onOpen,
}: {
  idea: WishIdea;
  wrap: Wrap;
  mine: boolean;
  busy: boolean;
  addedBy: string | null;
  claim: ClaimView | null;
  onClaim: () => void;
  onUnclaim: () => void;
  onOpen: () => void;
}) {
  const taken = !!claim;
  return (
    <li
      className={`rise relative flex overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)] ${taken && !claim.byMe ? "opacity-75" : ""}`}
      aria-busy={busy || undefined}
    >
      <span aria-hidden="true" className="relative w-3.5 shrink-0" style={{ background: wrap.paper }}>
        <span className="absolute top-4 left-1/2 size-[7px] -translate-x-1/2 rounded-full bg-card ring-1 ring-black/10" />
      </span>
      {idea.imagePath ? (
        <button onClick={onOpen} tabIndex={-1} aria-hidden="true" className="my-3 ml-3 size-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wishPictureUrl(idea.imagePath)} alt="" loading="lazy" className="h-full w-full object-contain" />
        </button>
      ) : null}
      <button onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-2 pl-3.5 text-left" aria-label={`${idea.title}. Open to see or change details`}>
        <span className="flex min-w-0 items-start gap-1.5">
          {idea.favourite ? (
            <IconStar className="mt-[3px] size-4 shrink-0 fill-[#e9b949]! stroke-[#c8962a]!" />
          ) : null}
          <span className={`min-w-0 font-semibold leading-snug ${taken && !claim.byMe ? "line-through decoration-mute/50" : ""}`}>{idea.title}</span>
        </span>
        {idea.note ? <span className="line-clamp-2 text-[14px] leading-snug text-mute">{idea.note}</span> : null}
        {idea.price || idea.link || addedBy ? (
          <span className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[12.5px]">
            {idea.price ? (
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: wrap.soft, color: wrap.paper }}>
                {idea.price}
              </span>
            ) : null}
            {idea.link ? (
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-sunk px-2 py-0.5 font-medium text-fg/80">
                <IconLink className="size-3.5 shrink-0" />
                <span className="truncate">{linkLabel(idea.link)}</span>
              </span>
            ) : null}
            {addedBy ? <span className="text-mute">added by {addedBy}</span> : null}
          </span>
        ) : null}
        {claim ? (
          <span className="flex items-center gap-1.5 pt-0.5 text-[13px] font-semibold text-ok">
            <span className="grid size-[18px] place-items-center rounded-full bg-ok-bg">
              <IconCheck className="size-3" />
            </span>
            {claim.byMe ? "You're getting this" : `${claim.name} is getting this`}
          </span>
        ) : null}
      </button>
      {mine ? null : claim ? (
        claim.byMe || claim.fromLink ? (
          <button onClick={onUnclaim} disabled={busy} className="min-h-11 shrink-0 self-center px-3.5 text-[13.5px] font-semibold text-mute hover:text-fg">
            {claim.byMe ? "Undo" : "Clear"}
          </button>
        ) : null
      ) : (
        <button
          onClick={onClaim}
          disabled={busy}
          className="mr-2.5 min-h-10 shrink-0 self-center rounded-xl px-3 font-display text-[13px] leading-tight font-bold transition active:scale-[0.97] disabled:opacity-55"
          style={{ background: wrap.paper, color: wrap.ink }}
        >
          I&apos;m getting
          <br />
          this
        </button>
      )}
    </li>
  );
}
