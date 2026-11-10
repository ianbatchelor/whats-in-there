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
  title,
  sub,
  soon = 0,
  index = 0,
  feature = false,
}: {
  href: string;
  type: LocationType;
  title: string;
  sub: string;
  soon?: number;
  index?: number;
  feature?: boolean;
}) {
  return (
    <li className={`rise ${feature ? "col-span-2 sm:col-span-1" : ""}`} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link href={href} className="group flex flex-col gap-2">
        <span className={`lift relative block overflow-hidden rounded-2xl bg-sunk ${feature ? "aspect-[2/1] sm:aspect-[4/3]" : "aspect-[4/3]"}`}>
          <PlacePhoto type={type} className="transition duration-700 ease-out group-hover:scale-[1.04]" eager={index < 6} />
          {soon > 0 ? (
            <span className="absolute top-2 left-2 flex h-6 items-center gap-1.5 rounded-full bg-white/95 px-2.5 text-[11.5px] font-semibold text-[#a63b1a]">
              <span className="size-1.5 rounded-full bg-[#c4502c]" aria-hidden="true" />
              {soon} to use soon
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

/** A kind of place on My Places. One place opens it directly; several open the list of them. */
export function GroupCard({ group, soon = 0, index = 0, feature = false }: { group: PlaceGroup; soon?: number; index?: number; feature?: boolean }) {
  const info = placeType(group.type);
  const single = group.places.length === 1 ? group.places[0]! : null;
  return (
    <Tile
      href={single ? `/place/?id=${single.id}` : `/places/?type=${group.type}`}
      type={group.type}
      title={single ? single.name : info.plural}
      sub={single ? countThings(single.itemCount) : `${countPlaces(group.places.length, group.type)} · ${countThings(group.itemCount)}`}
      soon={soon}
      index={index}
      feature={feature}
    />
  );
}

export function PlaceCard({ place, soon = 0, index = 0 }: { place: { id: string; name: string; type: LocationType; itemCount: number }; soon?: number; index?: number }) {
  return <Tile href={`/place/?id=${place.id}`} type={place.type} title={place.name} sub={countThings(place.itemCount)} soon={soon} index={index} />;
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
