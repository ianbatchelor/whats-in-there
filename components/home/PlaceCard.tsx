import Link from "next/link";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import type { LocationType } from "@/lib/household";
import type { PlaceGroup } from "@/lib/domain/places";
import { countThings } from "@/lib/domain/places";
import { countPlaces, placeType } from "./placeTypes";
import { IconPeople, IconPlus } from "@/components/ui/icons";
import { shortNames } from "@/lib/domain/access";

function Tile({
  href,
  type,
  imagePath,
  title,
  sub,
  late = 0,
  soon = 0,
  index = 0,
  feature = false,
  cover,
  shared,
  big = false,
}: {
  href: string;
  type: LocationType;
  imagePath?: string | null;
  title: string;
  sub: string;
  late?: number;
  soon?: number;
  index?: number;
  feature?: boolean;
  /** Drawn instead of the place photo, e.g. a box's own colour and contents. */
  cover?: React.ReactNode;
  /** First names of people outside the home who use it. */
  shared?: string[];
  /** Home's larger card: a taller photo with the name on it. */
  big?: boolean;
}) {
  if (big) return <BigTile {...{ href, type, imagePath, title, sub, late, soon, index, shared }} />;
  return (
    <li className={`rise ${feature ? "col-span-2 sm:col-span-1" : ""}`} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link href={href} className="group flex flex-col gap-2">
        <span className={`lift relative block overflow-hidden rounded-2xl bg-sunk ${feature ? "aspect-[2/1] sm:aspect-[4/3]" : "aspect-[4/3]"}`}>
          {cover ?? <PlacePhoto type={type} imagePath={imagePath} className="transition duration-700 ease-out group-hover:scale-[1.04]" eager={index < 6} />}
          {late > 0 || soon > 0 ? <UrgencyBadge late={late} soon={soon} /> : null}
          {shared && shared.length > 0 ? (
            <span className="absolute bottom-2 left-2 flex h-6 max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full bg-white/95 px-2.5 text-[12.5px] font-semibold text-[#1e4a38]">
              <IconPeople className="size-3.5 shrink-0" />
              <span className="sr-only">Shared with </span>
              <span className="truncate">{shortNames(shared)}</span>
            </span>
          ) : null}
        </span>
        <span className="min-w-0 px-0.5">
          <span className="block truncate text-[15px] leading-snug font-semibold">{title}</span>
          <span className="block truncate text-[13px] text-mute">{sub}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Home's place card: a tall photo with the name set on it, so the places read as the heart of
 * the page. Urgency sits at the top, who else uses it underneath.
 */
function BigTile({ href, type, imagePath, title, sub, late, soon, index, shared }: { href: string; type: LocationType; imagePath?: string | null; title: string; sub: string; late: number; soon: number; index: number; shared?: string[] }) {
  return (
    <li className="rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link href={href} className="group lift relative block aspect-[4/5] overflow-hidden rounded-[20px] bg-sunk shadow-[var(--shadow-card)] sm:aspect-[5/4]">
        <PlacePhoto type={type} imagePath={imagePath} className="transition duration-700 ease-out group-hover:scale-[1.04]" eager={index < 6} />
        <span className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/75 via-black/30 to-transparent" aria-hidden="true" />
        {late > 0 || soon > 0 ? <UrgencyBadge late={late} soon={soon} short /> : null}
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-3.5 pb-3 text-white">
          {shared && shared.length > 0 ? (
            <span className="flex h-6 max-w-full items-center gap-1 self-start truncate rounded-full bg-white/95 px-2.5 text-[12.5px] font-semibold text-[#1e4a38]">
              <IconPeople className="size-3.5 shrink-0" />
              <span className="sr-only">Shared with </span>
              <span className="truncate">{shortNames(shared)}</span>
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="block truncate font-display text-[18px] leading-tight font-bold tracking-[-0.01em] drop-shadow-sm">{title}</span>
            <span className="block truncate text-[13px] text-white/85">{sub}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

/** The most urgent count leads, in its own colour: "1 past its date · 4 soon", or "4 to use soon". */
function UrgencyBadge({ late, soon, short = false }: { late: number; soon: number; /** Fewer words, for Home's narrower cards. */ short?: boolean }) {
  return (
    <span className="absolute top-2 left-2 flex h-6 max-w-[calc(100%-1rem)] items-center gap-1.5 truncate rounded-full bg-white/95 px-2.5 text-[12.5px] font-semibold">
      <span className={`size-1.5 shrink-0 rounded-full ${late > 0 ? "bg-[#c4502c]" : "bg-[#c98a14]"}`} aria-hidden="true" />
      {late > 0 ? (
        <>
          <span className="text-[#a63b1a]">
            {late} past {short ? "date" : late === 1 ? "its date" : "a date"}
          </span>
          {soon > 0 ? <span className="text-[#855a0b]">· {soon} soon</span> : null}
        </>
      ) : (
        <span className="text-[#855a0b]">{soon} to use soon</span>
      )}
    </span>
  );
}

/** A kind of place on My Places. One place opens it directly; several open the list of them. */
export function GroupCard({
  group,
  late = 0,
  soon = 0,
  index = 0,
  feature = false,
  shared,
  big = false,
}: {
  group: PlaceGroup;
  late?: number;
  soon?: number;
  index?: number;
  feature?: boolean;
  /** Who else uses each place, by place id. */
  shared?: Map<string, string[]>;
  big?: boolean;
}) {
  const sharedWith = [...new Set(group.places.flatMap((p) => shared?.get(p.id) ?? []))];
  const info = placeType(group.type);
  const single = group.places.length === 1 ? group.places[0]! : null;
  return (
    <Tile
      href={single ? `/place/?id=${single.id}` : `/places/?type=${group.type}`}
      type={group.type}
      imagePath={single ? single.imagePath : (group.places.find((p) => p.imagePath)?.imagePath ?? null)}
      title={single ? single.name : info.plural}
      sub={
        single
          ? [countThings(single.itemCount), single.boxCount ? `${single.boxCount} ${single.boxCount === 1 ? "box" : "boxes"}` : null]
              .filter(Boolean)
              .join(" · ")
          : `${countPlaces(group.places.length, group.type)} · ${countThings(group.itemCount)}`
      }
      late={late}
      soon={soon}
      index={index}
      feature={feature}
      shared={sharedWith}
      big={big}
    />
  );
}

export function PlaceCard({
  place,
  soon = 0,
  index = 0,
  cover,
  sub,
  shared,
  big = false,
}: {
  place: { id: string; name: string; type: LocationType; itemCount: number; imagePath?: string | null };
  shared?: string[];
  soon?: number;
  index?: number;
  cover?: React.ReactNode;
  /** Replaces the count under the name. */
  sub?: string;
  big?: boolean;
}) {
  return (
    <Tile
      href={`/place/?id=${place.id}`}
      type={place.type}
      imagePath={place.imagePath}
      title={place.name}
      sub={sub ?? countThings(place.itemCount)}
      soon={soon}
      index={index}
      cover={cover}
      shared={shared}
      big={big && !cover}
    />
  );
}

export function AddPlaceTile({ onClick, label = "Add a place", big = false }: { onClick: () => void; label?: string; big?: boolean }) {
  if (big)
    return (
      <li>
        <button
          onClick={onClick}
          className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line text-leaf transition hover:border-leaf/50 hover:bg-sunk sm:aspect-[5/4]"
        >
          <IconPlus className="size-6" />
          <span className="text-[15px] font-semibold">{label}</span>
        </button>
      </li>
    );
  return (
    <li>
      <button onClick={onClick} className="group flex w-full flex-col gap-2 text-left">
        <span className="grid aspect-[4/3] w-full place-items-center rounded-2xl border-[1.5px] border-dashed border-line text-leaf transition group-hover:border-leaf/50 group-hover:bg-sunk">
          <IconPlus className="size-6" />
        </span>
        <span className="px-0.5 text-[15px] font-semibold text-leaf">{label}</span>
      </button>
    </li>
  );
}
