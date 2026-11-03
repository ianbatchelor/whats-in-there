const fills = ["bg-ice text-fg", "bg-tape text-on-tape", "bg-go text-on-go", "bg-fg text-bg"];

export function Avatar({ name, index = 0, size = 32 }: { name: string; index?: number; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      title={name}
      className={`inline-grid shrink-0 place-items-center rounded-full border-2 border-bg font-bold ${fills[index % fills.length]}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initial}
    </span>
  );
}
