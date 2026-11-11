import Link from "next/link";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import type { LocationType } from "@/lib/household";
import type { PlaceGroup } from "@/lib/domain/places";
import { countThings } from "@/lib/domain/places";
import { countPlaces, placeType } from "./placeTypes";
import { IconPlus } from "@/components/ui/icons";

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
}) {
  return (
    <li className={`rise ${feature ? "col-span-2 sm:col-span-1" : ""}`} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link href={href} className="group flex flex-col gap-2">
        <span className={`lift relative block overflow-hidden rounded-2xl bg-sunk ${feature ? "aspect-[2/1] sm:aspect-[4/3]" : "aspect-[4/3]"}`}>
          <PlacePhoto type={type} imagePath={imagePath} className="transition duration-700 ease-out group-hover:scale-[1.04]" eager={index < 6} />
          {late > 0 || soon > 0 ? <UrgencyBadge late={late} soon={soon} /> : null}
        </span>
        <span className="min-w-0 px-0.5">
          <span className="block truncate text-[15px] leading-snug font-semibold">{title}</span>
          <span className="block truncate text-[13px] text-mute">{sub}</span>
        </span>
      </Link>
    </li>
  );
}

/** The most urgent count leads, in its own colour: "1 past its date · 4 soon", or "4 to use soon". */
function UrgencyBadge({ late, soon }: { late: number; soon: number }) {
  return (
    <span className="absolute top-2 left-2 flex h-6 max-w-[calc(100%-1rem)] items-center gap-1.5 truncate rounded-full bg-white/95 px-2.5 text-[12.5px] font-semibold">
      <span className={`size-1.5 shrink-0 rounded-full ${late > 0 ? "bg-[#c4502c]" : "bg-[#c98a14]"}`} aria-hidden="true" />
      {late > 0 ? (
        <>
          <span className="text-[#a63b1a]">{late} past {late === 1 ? "its date" : "a date"}</span>
          {soon > 0 ? <span className="text-[#855a0b]">· {soon} soon</span> : null}
        </>
      ) : (
        <span className="text-[#855a0b]">{soon} to use soon</span>
      )}
    </span>
  );
}

/** A kind of place on My Places. One place opens it directly; several open the list of them. */
export function GroupCard({ group, late = 0, soon = 0, index = 0, feature = false }: { group: PlaceGroup; late?: number; soon?: number; index?: number; feature?: boolean }) {
  const info = placeType(group.type);
  const single = group.places.length === 1 ? group.places[0]! : null;
  return (
    <Tile
      href={single ? `/place/?id=${single.id}` : `/places/?type=${group.type}`}
      type={group.type}
      imagePath={single ? single.imagePath : (group.places.find((p) => p.imagePath)?.imagePath ?? null)}
      title={single ? single.name : info.plural}
      sub={single ? countThings(single.itemCount) : `${countPlaces(group.places.length, group.type)} · ${countThings(group.itemCount)}`}
      late={late}
      soon={soon}
      index={index}
      feature={feature}
    />
  );
}

export function PlaceCard({ place, soon = 0, index = 0 }: { place: { id: string; name: string; type: LocationType; itemCount: number; imagePath?: string | null }; soon?: number; index?: number }) {
  return <Tile href={`/place/?id=${place.id}`} type={place.type} imagePath={place.imagePath} title={place.name} sub={countThings(place.itemCount)} soon={soon} index={index} />;
}

export function AddPlaceTile({ onClick }: { onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="group flex w-full flex-col gap-2 text-left">
        <span className="grid aspect-[4/3] w-full place-items-center rounded-2xl border-[1.5px] border-dashed border-line text-leaf transition group-hover:border-leaf/50 group-hover:bg-sunk">
          <IconPlus className="size-6" />
        </span>
        <span className="px-0.5 text-[15px] font-semibold text-leaf">Add a place</span>
      </button>
    </li>
  );
}
