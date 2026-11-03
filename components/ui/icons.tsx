/** Stroke icons drawn for the app; 24px grid, currentColor. */
type P = { className?: string };
const base = "fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round]";
const svg = (d: React.ReactNode, className = "size-5") => (
  <svg viewBox="0 0 24 24" className={`${base} ${className}`} strokeWidth={1.8} aria-hidden="true">
    {d}
  </svg>
);

export const IconSnow = ({ className }: P) => svg(<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10M9 4l3 2 3-2M9 20l3-2 3 2" />, className);
export const IconFridge = ({ className }: P) =>
  svg(<><rect x="5" y="2.5" width="14" height="19" rx="3" /><path d="M5 9.5h14M8.5 5.5v1.5M8.5 12.5v3" /></>, className);
export const IconJar = ({ className }: P) => svg(<><rect x="5.5" y="7" width="13" height="14" rx="3" /><path d="M7 3.5h10v3.5H7z" /></>, className);
export const IconCupboard = ({ className }: P) =>
  svg(<><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M12 3.5v17M9.5 11v2M14.5 11v2" /></>, className);
export const IconWine = ({ className }: P) => svg(<path d="M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0zM12 12.5V20M8.5 20.5h7" />, className);
export const IconBox = ({ className }: P) => svg(<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9" />, className);
export const IconPlus = ({ className }: P) => svg(<path d="M12 5v14M5 12h14" />, className);
export const IconChevronLeft = ({ className }: P) => svg(<path d="m15 5-7 7 7 7" />, className);
export const IconChevronRight = ({ className }: P) => svg(<path d="m9 5 7 7-7 7" />, className);
export const IconCopy = ({ className }: P) => svg(<><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>, className);
export const IconCheck = ({ className }: P) => svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, className);
export const IconPeople = ({ className }: P) =>
  svg(<><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9.5" r="2.7" /><path d="M16.5 14.6a5 5 0 0 1 5 4.9" /></>, className);
export const IconMail = ({ className }: P) => svg(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>, className);
export const IconCamera = ({ className }: P) =>
  svg(<><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.5" /></>, className);
