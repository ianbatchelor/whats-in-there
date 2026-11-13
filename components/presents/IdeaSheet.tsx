"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { IconLink, IconStar } from "@/components/ui/icons";
import { friendlyError } from "@/lib/supabase/errors";
import { cleanLink, cleanPrice, firstName, linkLabel, linkProblem, looksLikeLink, type WishIdea, type WishKind } from "@/lib/domain/presents";
import { readLink, updateIdea, wishPictureUrl } from "@/lib/presents";

/** The details of one idea: a note (size, colour), a shop link, a rough price, and top of the list. */
export function IdeaSheet({
  idea,
  mine,
  personName,
  householdId,
  onClose,
  onSaved,
  onRemove,
  kind = "presents",
}: {
  kind?: WishKind;
  idea: WishIdea | null;
  mine: boolean;
  personName: string;
  householdId: string;
  onClose: () => void;
  onSaved: () => void;
  onRemove: (idea: WishIdea) => void;
}) {
  const books = kind === "books";
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [price, setPrice] = useState("");
  const [favourite, setFavourite] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | undefined>();

  useEffect(() => {
    if (!idea) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTitle(idea.title);
    setAuthor(idea.author ?? "");
    setNote(idea.note ?? "");
    setLink(idea.link ?? "");
    setPrice(idea.price ?? "");
    setFavourite(idea.favourite);
    setImagePath(idea.imagePath);
    setReadNote(null);
    setError(null);
    setLinkError(undefined);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [idea]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!idea || !title.trim()) return;
    const l = cleanLink(link);
    if (l === "bad") {
      setLinkError("That doesn't look like a web address. Paste the link from the shop's page.");
      return;
    }
    setLinkError(undefined);
    setBusy(true);
    setError(null);
    try {
      await updateIdea(idea.id, {
        title: title.trim(),
        note: note.trim() || null,
        link: l,
        price: cleanPrice(price),
        favourite,
        imagePath,
        ...(books ? { author: author.trim() || null } : {}),
      });
      onSaved();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  // Fill in from the shop link: always the picture and price; the name only if it's still the
  // placeholder or a pasted link, so a name someone typed is never overwritten.
  async function fillFromLink() {
    const l = cleanLink(link);
    if (!l || l === "bad") {
      setLinkError("Paste the link from the shop's page first.");
      return;
    }
    setLinkError(undefined);
    setReading(true);
    setReadNote(null);
    const got = await readLink(householdId, l);
    setReading(false);
    if (!got.ok) {
      setReadNote(linkProblem(got.code, got.shop ?? linkLabel(l)));
      return;
    }
    const r = got.reading;
    setLink(l);
    const placeholder = !title.trim() || looksLikeLink(title) || /^Something from /.test(title);
    if (r.title && placeholder) setTitle(r.title);
    if (r.price) setPrice(r.price);
    if (r.imagePath) setImagePath(r.imagePath);
    const missing = [!r.title && "name", !r.price && "price", !r.imagePath && "picture"].filter(Boolean);
    setReadNote(
      missing.length ? `Filled in what ${r.shop} showed. No ${missing.join(" or ")} found, so add ${missing.length > 1 ? "those" : "that"} yourself.` : `Filled in from ${r.shop}. Prices change, so check before buying.`,
    );
  }

  return (
    <Sheet
      open={!!idea}
      onClose={onClose}
      title={books ? (mine ? "Your book" : `Book for ${firstName(personName)}`) : mine ? "Your idea" : `Idea for ${firstName(personName)}`}
    >
      <form onSubmit={save} className="-mx-1 flex max-h-[78dvh] flex-col gap-4 overflow-y-auto px-1 pb-1">
        {imagePath ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wishPictureUrl(imagePath)} alt="" className="size-20 shrink-0 rounded-xl bg-white object-contain ring-1 ring-line" />
            <button type="button" onClick={() => setImagePath(null)} className="min-h-10 text-[14px] font-semibold text-mute hover:text-fg">
              Remove picture
            </button>
          </div>
        ) : null}
        <Field label={books ? "Title" : "What is it?"} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        {books ? <Field label="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} placeholder="Hilary Mantel" /> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="idea-note" className="font-display text-sm font-bold">
            Details <span className="font-normal text-mute">(optional)</span>
          </label>
          <textarea
            id="idea-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={books ? "The paperback, please" : "Size M, the dark blue one"}
            className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-base text-fg placeholder:text-mute/80 focus:border-leaf focus:ring-4 focus:ring-leaf/15 focus:outline-none"
          />
        </div>
        <Field
          label="Shop link (optional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Paste a link to where it's sold"
          error={linkError}
        />
        {link.trim() ? (
          <div className="-mt-2 flex flex-col gap-1">
            <Button type="button" variant="ghost" onClick={fillFromLink} busy={reading} className="min-h-10 self-start rounded-xl px-3.5 text-[14px]">
              {reading ? "Reading the shop page…" : "Fill in from link"}
            </Button>
            {readNote ? (
              <p role="status" className="text-[13.5px] text-mute">
                {readNote}
              </p>
            ) : null}
          </div>
        ) : null}
        <Field label="Rough price (optional)" value={price} onChange={(e) => setPrice(e.target.value)} maxLength={30} placeholder="About £25" />
        <button
          type="button"
          onClick={() => setFavourite((f) => !f)}
          aria-pressed={favourite}
          className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-left transition ${favourite ? "border-[#e9c46a] bg-check" : "border-line bg-card"}`}
        >
          <IconStar className={`size-5 shrink-0 ${favourite ? "fill-[#e9b949]! stroke-[#c8962a]!" : "text-mute"}`} />
          <span className="flex-1">
            <span className="block font-semibold">{books ? "Most wanted" : "Top of the list"}</span>
            <span className="block text-[13.5px] text-mute">Shown first, with a star.</span>
          </span>
        </button>

        {idea?.link ? (
          <a
            href={idea.link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-11 w-fit items-center gap-2 font-display text-[15px] font-bold text-leaf"
          >
            <IconLink className="size-[18px]" /> Open {linkLabel(idea.link)}
          </a>
        ) : null}

        {error ? <Notice>{error}</Notice> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button type="button" variant="danger" onClick={() => idea && onRemove(idea)} className="px-2">
            Take off the list
          </Button>
          <Button type="submit" busy={busy} disabled={!title.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
