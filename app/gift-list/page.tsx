"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Splash } from "@/components/ui/Screen";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconLink, IconStar } from "@/components/ui/icons";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { friendlyError } from "@/lib/supabase/errors";
import { firstName, linkLabel, wrapFor } from "@/lib/domain/presents";
import { wishPictureUrl } from "@/lib/presents";
import { loadViewerList, removeListViewer, viewerClaim, viewerUnclaim, type ViewerIdea, type ViewerList } from "@/lib/listViewers";

export default function GiftListPage() {
  return <AuthGate>{(session) => <GiftList session={session} />}</AuthGate>;
}

/**
 * One present list someone was let into (Carol, for Michele's). Shows only the ideas nobody is getting
 * yet, plus the ones they're getting themselves, and lets them say "I'm getting this".
 */
function GiftList({ session }: { session: Session }) {
  const router = useRouter();
  const id = useQueryParam("id");
  const [list, setList] = useState<ViewerList | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return setList(null);
    try {
      setList(await loadViewerList(id));
    } catch (e) {
      setError(friendlyError(e));
      setList(null);
    }
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [id, load]);

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
      load();
    }
  }

  if (list === undefined) return <Splash />;
  const back = { href: "/", label: "Home" };

  if (!list || !id) {
    return (
      <AppShell>
        <PageHeader title="Present list" back={back} serif />
        {error ? <Notice>{error}</Notice> : null}
        <p className="rounded-[var(--radius-card)] border-2 border-dashed border-line p-6 text-center text-mute">
          This list isn&apos;t shared with you any more. Ask whoever invited you if you think it should be.
        </p>
      </AppShell>
    );
  }

  const wrap = wrapFor(0);
  const whose = firstName(list.name);
  const free = list.ideas.filter((i) => !i.mine).length;

  return (
    <AppShell>
      <PageHeader title={`${whose} would love…`} sub={`From ${list.household}. Shared with you only.`} back={back} serif />

      <div className="rounded-[var(--radius-card)] border border-line bg-card px-5 py-4 text-[15px] text-mute shadow-[var(--shadow-card)]">
        Tap <b className="text-fg">I&apos;m getting this</b> on the one you choose, so nobody buys the same thing twice. {whose} won&apos;t see.{" "}
        {list.ideas.length > 0 ? <span className="whitespace-nowrap">{free === 0 ? "Nothing else is free." : `${free} still free.`}</span> : null}
      </div>

      {error ? <Notice>{error}</Notice> : null}

      {list.ideas.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border-2 border-dashed border-line p-6 text-center text-mute">
          {list.hidden > 0
            ? `Everything on ${whose}'s list is already being got by someone. Check back later in case more ideas are added.`
            : `Nothing on ${whose}'s list yet. Check back soon.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.ideas.map((i) => (
            <IdeaCard
              key={i.id}
              idea={i}
              wrap={wrap}
              busy={busy}
              onClaim={() => run(i.id, () => viewerClaim(id, i.id))}
              onUndo={() => run(i.id, () => viewerUnclaim(id, i.id))}
            />
          ))}
        </ul>
      )}

      {list.hidden > 0 && list.ideas.length > 0 ? (
        <p className="px-2 text-center text-[14px] text-mute">
          {list.hidden === 1 ? "1 idea is" : `${list.hidden} ideas are`} already being got by someone else, so {list.hidden === 1 ? "it's" : "they're"} not shown.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col items-start gap-2 border-t border-line pt-5">
        {leaving ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[14.5px]">Leave {whose}&apos;s list? You&apos;d need a new invitation to see it again.</span>
            <Button
              variant="ghost"
              busy={busy === "leave"}
              onClick={() =>
                run("leave", async () => {
                  await removeListViewer(id, session.user.id);
                  router.replace("/");
                })
              }
            >
              Leave
            </Button>
            <button onClick={() => setLeaving(false)} className="min-h-10 text-[14px] font-semibold text-mute hover:text-fg">
              Keep it
            </button>
          </div>
        ) : (
          <button onClick={() => setLeaving(true)} className="min-h-10 text-[14px] font-semibold text-mute hover:text-fg">
            Leave this list
          </button>
        )}
      </div>
    </AppShell>
  );
}

function IdeaCard({
  idea: i,
  wrap,
  busy,
  onClaim,
  onUndo,
}: {
  idea: ViewerIdea;
  wrap: ReturnType<typeof wrapFor>;
  busy: string | null;
  onClaim: () => void;
  onUndo: () => void;
}) {
  return (
    <li className="rise flex overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
      <span aria-hidden="true" className="relative w-3.5 shrink-0" style={{ background: wrap.paper }}>
        <span className="absolute top-4 left-1/2 size-[7px] -translate-x-1/2 rounded-full bg-card ring-1 ring-black/10" />
      </span>
      {i.imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wishPictureUrl(i.imagePath)} alt="" loading="lazy" className="my-3.5 ml-3.5 size-20 shrink-0 rounded-xl bg-white object-contain ring-1 ring-line" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-3.5 pr-3 pl-3.5">
        <p className="flex items-start gap-1.5">
          {i.favourite ? <IconStar className="mt-[3px] size-4 shrink-0 fill-[#e9b949]! stroke-[#c8962a]!" /> : null}
          <span className="font-semibold leading-snug">{i.title}</span>
        </p>
        {i.note ? <p className="text-[14px] leading-snug text-mute">{i.note}</p> : null}
        {i.price || i.link ? (
          <p className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[12.5px]">
            {i.price ? (
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: wrap.soft, color: wrap.paper }}>
                {i.price}
              </span>
            ) : null}
            {i.link ? (
              <a
                href={i.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-h-8 min-w-0 items-center gap-1 rounded-full bg-sunk px-2.5 font-semibold text-leaf"
              >
                <IconLink className="size-3.5 shrink-0" />
                <span className="truncate">See it at {linkLabel(i.link)}</span>
              </a>
            ) : null}
          </p>
        ) : null}
        {i.mine ? (
          <div className="flex flex-wrap items-center gap-x-3 pt-1">
            <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ok">
              <span className="grid size-[18px] place-items-center rounded-full bg-ok-bg">
                <IconCheck className="size-3" />
              </span>
              You&apos;re getting this
            </span>
            <button onClick={onUndo} disabled={busy !== null} className="min-h-10 text-[13.5px] font-semibold text-mute hover:text-fg">
              Undo
            </button>
          </div>
        ) : (
          <div className="pt-1.5">
            <button
              onClick={onClaim}
              disabled={busy !== null}
              className="min-h-10 rounded-xl px-3.5 font-display text-[14px] font-bold transition active:scale-[0.97] disabled:opacity-55"
              style={{ background: wrap.paper, color: wrap.ink }}
            >
              I&apos;m getting this
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
