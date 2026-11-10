import qrcode from "qrcode-generator";

/** A QR code drawn as one SVG path, so it stays sharp on screen and on paper. */
export function QrCode({ value, className = "", title }: { value: string; className?: string; title?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  const size = n + quiet * 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={title ?? "QR code"} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
