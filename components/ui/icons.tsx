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
export const IconMinus = ({ className }: P) => svg(<path d="M5 12h14" />, className);
export const IconPlus = ({ className }: P) => svg(<path d="M12 5v14M5 12h14" />, className);
export const IconChevronLeft = ({ className }: P) => svg(<path d="m15 5-7 7 7 7" />, className);
export const IconChevronRight = ({ className }: P) => svg(<path d="m9 5 7 7-7 7" />, className);
export const IconCopy = ({ className }: P) => svg(<><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>, className);
export const IconCheck = ({ className }: P) => svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, className);
export const IconUndo = ({ className }: P) => svg(<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />, className);
export const IconPeople = ({ className }: P) =>
  svg(<><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9.5" r="2.7" /><path d="M16.5 14.6a5 5 0 0 1 5 4.9" /></>, className);
export const IconMail = ({ className }: P) => svg(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>, className);
export const IconCamera = ({ className }: P) =>
  svg(<><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.5" /></>, className);
export const IconHouse = ({ className }: P) => svg(<path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" />, className);
export const IconWrench = ({ className }: P) =>
  svg(<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L20 11l-9 9a2.1 2.1 0 0 1-3-3l9-9 .1-.6a4 4 0 0 1-2.6-1.9z" />, className);
export const IconShed = ({ className }: P) => svg(<path d="M3 10 12 4l9 6M5 9v11h14V9M9.5 20v-7h5v7" />, className);
export const IconHanger = ({ className }: P) =>
  svg(<path d="M12 7.5a2 2 0 1 1 2-2c0 1-1 1.5-2 2.2v1L3.6 15a1.5 1.5 0 0 0 .9 2.7h15a1.5 1.5 0 0 0 .9-2.7L12 8.7" />, className);
export const IconSprout = ({ className }: P) =>
  svg(<path d="M12 21v-9M12 12c0-4-3-6.5-7.5-6.5C4.5 10 7 12 12 12zM12 14c0-3.5 2.5-6 7-6 0 4-2.5 6-7 6z" />, className);
export const IconSearch = ({ className }: P) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></>, className);
export const IconHome = ({ className }: P) => svg(<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z" />, className);
export const IconActivity = ({ className }: P) => svg(<path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />, className);
export const IconUser = ({ className }: P) => svg(<><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" /></>, className);
export const IconPlusCircle = ({ className }: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></>, className);
export const IconPencil = ({ className }: P) => svg(<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />, className);
export const IconTag = ({ className }: P) => svg(<><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z" /><circle cx="8.5" cy="8.5" r="1.5" /></>, className);

/* Kinds of thing, for the small tiles in lists. */
export const IconMeat = ({ className }: P) =>
  svg(<><path d="M14.5 4c3.6 0 5.5 2.6 5.5 5.6 0 5-5.6 9.4-10.5 9.4-3 0-5.5-1.9-5.5-4.5 0-3 3.2-3.7 4.3-5.9C9.4 6.4 11 4 14.5 4z" /><circle cx="14" cy="10" r="2" /></>, className);
export const IconFish = ({ className }: P) =>
  svg(<><path d="M3 12c2.5-4 6-6 10-6 3.5 0 6.5 2.5 8 6-1.5 3.5-4.5 6-8 6-4 0-7.5-2-10-6z" /><path d="M3 7.5 6 12l-3 4.5" /><circle cx="16.5" cy="10.8" r=".6" /></>, className);
export const IconMilk = ({ className }: P) => svg(<path d="M9 3h6v3l2.5 3.5V21h-11V9.5L9 6zM6.5 13.5h11" />, className);
export const IconLeaf = ({ className }: P) => svg(<path d="M5 19C5 10.5 10 5.5 20 4.5c0 10-5 14.5-15 14.5zM5 19l8-8" />, className);
export const IconBread = ({ className }: P) => svg(<path d="M6 10.5a3.5 3.5 0 0 1 1-6.8h10a3.5 3.5 0 0 1 1 6.8V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM10 9v2M14 9v2" />, className);
export const IconTin = ({ className }: P) =>
  svg(<><ellipse cx="12" cy="6" rx="6.5" ry="2.5" /><path d="M5.5 6v12c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6M5.5 11.5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5" /></>, className);
export const IconCup = ({ className }: P) => svg(<path d="M6 4h12l-1.3 15a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.8zM6.5 9.5h11" />, className);
export const IconBulb = ({ className }: P) => svg(<path d="M9 17.5h6M10 20.5h4M8.5 14.5a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2v1h-5v-1c0-.8-.4-1.5-1-2z" />, className);
/** Books standing on a shelf: adding many things at once. */
export const IconStack = ({ className }: P) =>
  svg(<path d="M4.5 4.5h3v15h-3zM9 6.5h3v13H9zM13.3 7.6l2.9-.8 3.4 12.5-2.9.8zM3 19.5h18" />, className);
export const IconBook = ({ className }: P) => svg(<path d="M5 4.5h11.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2zM5 17.5a2 2 0 0 1 2-2h11.5M9 8.5h6" />, className);
export const IconScan = ({ className }: P) =>
  svg(<><path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16" /><circle cx="12" cy="12" r="3.2" /></>, className);
export const IconX = ({ className }: P) => svg(<path d="M6 6l12 12M18 6 6 18" />, className);
/** A round sticker with contactless waves. */
export const IconSticker = ({ className }: P) =>
  svg(<><circle cx="12" cy="12" r="8.5" /><path d="M10 9a4.5 4.5 0 0 1 0 6M13 7a7.5 7.5 0 0 1 0 10" /><circle cx="7.6" cy="12" r=".9" /></>, className);
export const IconPrinter = ({ className }: P) =>
  svg(<><path d="M7 8V3.5h10V8M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 5 8h14a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 19 17h-2" /><path d="M7 13.5h10v7H7z" /></>, className);
export const IconMove = ({ className }: P) => svg(<path d="M4 12h12M12 7l5 5-5 5M20 5v14" />, className);
export const IconBlocks = ({ className }: P) =>
  svg(<><rect x="3.5" y="12.5" width="8" height="8" rx="1.5" /><rect x="12.5" y="12.5" width="8" height="8" rx="1.5" /><path d="M8 11.5 12 4l4 7.5z" /></>, className);
export const IconDesk = ({ className }: P) => svg(<path d="M3 9.5h18M5 9.5V20M19 9.5V20M13 9.5v6h6M15.5 12.5h1M8 9.5V5.5h5v4" />, className);
export const IconMedicine = ({ className }: P) => svg(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></>, className);
export const IconCar = ({ className }: P) =>
  svg(<><path d="M4 16.5V12l2-5h12l2 5v4.5zM4 12h16" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /></>, className);
export const IconGrid = ({ className }: P) =>
  svg(<><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>, className);
export const IconList = ({ className }: P) => svg(<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5" />, className);
export const IconHandOver = ({ className }: P) =>
  svg(<path d="M3 15.5h3.5l4 1.5h4a1.5 1.5 0 0 0 0-3H11M6.5 20.5H3v-8h3.5zM14.5 14l4.2-2.1a1.6 1.6 0 0 1 1.8 2.6L15 19.5l-5 .5-3.5-1.2M12 3.5h6v5h-6z" />, className);
