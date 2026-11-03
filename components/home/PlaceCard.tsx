import Link from "next/link";
import { PlacePhoto } from "@/components/art/PlacePhoto";
import type { LocationType } from "@/lib/household";
import type { PlaceGroup } from "@/lib/domain/places";
import { countThings } from "@/lib/domain/places";
import { countPlaces, placeType } from "./placeTypes";

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
    <li className={`rise ${feature ? "col-span-2" : ""}`} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link
        href={href}
        className={`lift group relative block overflow-hidden rounded-[20px] bg-sunk ${feature ? "aspect-[2/1] sm:aspect-auto sm:h-60" : "aspect-[1/1] sm:aspect-auto sm:h-60"}`}
      >
        <PlacePhoto type={type} className="transition duration-700 ease-out group-hover:scale-[1.05]" eager={index < 4} />
        <span className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/5 to-black/75" aria-hidden="true" />
        {soon > 0 ? (
          <span className="absolute top-2.5 left-2.5 flex h-6 items-center gap-1.5 rounded-full bg-[#fffdf8]/95 px-2.5 text-[11.5px] font-bold text-[#9a3d1d]">
            <span className="size-1.5 rounded-full bg-[#c4502c]" aria-hidden="true" />
            {soon} to use soon
          </span>
        ) : null}
        <span className="absolute inset-x-3 bottom-2.5 text-[#fffdf8] [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">
          <span className={`block truncate font-display font-bold ${feature ? "text-xl sm:text-2xl" : "text-[15.5px]"}`}>{title}</span>
          <span className="block truncate text-[12.5px] text-[#fffdf8]/85">{sub}</span>
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
      <button
        onClick={onClick}
        className="flex aspect-[1/1] w-full flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line text-leaf transition hover:border-leaf/40 hover:bg-sunk sm:aspect-auto sm:h-60"
      >
        <span className="grid size-11 place-items-center rounded-full bg-card text-2xl font-bold shadow-[var(--shadow-card)]">+</span>
        <span className="font-display text-[15px] font-bold">Add a place</span>
      </button>
    </li>
  );
}
