import Link from "next/link";
import { PlaceArt } from "@/components/art/PlaceArt";
import type { PlaceGroup } from "@/lib/domain/places";
import { countThings } from "@/lib/domain/places";
import { countPlaces, placeType } from "./placeTypes";

/** A kind of place on My Places. One place opens it directly; several open the list of them. */
export function GroupCard({ group, index = 0 }: { group: PlaceGroup; index?: number }) {
  const info = placeType(group.type);
  const single = group.places.length === 1 ? group.places[0]! : null;
  const href = single ? `/place/?id=${single.id}` : `/places/?type=${group.type}`;
  const title = single ? single.name : info.plural;
  const sub = single ? `${info.label === "Something else" ? "Place" : info.label} · ${countThings(single.itemCount)}` : `${countPlaces(group.places.length, group.type)} · ${countThings(group.itemCount)}`;
  return (
    <li className="rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link href={href} className="lift group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
        <div className="aspect-[16/11] overflow-hidden">
          <PlaceArt type={group.type} className="transition duration-500 group-hover:scale-[1.04]" />
        </div>
        <div className="px-3.5 pt-2.5 pb-3">
          <p className="truncate font-display text-[16px] leading-tight font-bold">{title}</p>
          <p className="mt-0.5 truncate text-[13px] text-mute">{sub}</p>
        </div>
      </Link>
    </li>
  );
}

export function PlaceCard({ place, index = 0 }: { place: { id: string; name: string; type: PlaceGroup["type"]; itemCount: number }; index?: number }) {
  return (
    <li className="rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link href={`/place/?id=${place.id}`} className="lift group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
        <div className="aspect-[16/11] overflow-hidden">
          <PlaceArt type={place.type} className="transition duration-500 group-hover:scale-[1.04]" />
        </div>
        <div className="px-3.5 pt-2.5 pb-3">
          <p className="truncate font-display text-[16px] leading-tight font-bold">{place.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-mute">{countThings(place.itemCount)}</p>
        </div>
      </Link>
    </li>
  );
}

export function AddPlaceTile({ onClick }: { onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex aspect-[16/11] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-sunk/50 text-leaf transition hover:border-leaf/40 hover:bg-sunk sm:aspect-auto sm:h-full sm:min-h-44"
      >
        <span className="grid size-11 place-items-center rounded-full bg-card text-2xl font-bold shadow-[var(--shadow-card)]">+</span>
        <span className="font-display text-[15px] font-bold">Add a place</span>
      </button>
    </li>
  );
}
