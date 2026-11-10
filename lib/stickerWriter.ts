import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Writing a place's link to an NFC sticker from inside the app.
 * - iPhone and Android apps: the native StickerNfc plugin (native/sticker-nfc).
 * - Website: Web NFC, which only Chrome on Android has. Apple doesn't let websites use NFC.
 */
type StickerNfcPlugin = {
  isAvailable(): Promise<{ available: boolean; enabled?: boolean }>;
  writeUrl(options: { url: string; prompt?: string; doneMessage?: string }): Promise<void>;
  cancel(): Promise<void>;
};
const StickerNfc = registerPlugin<StickerNfcPlugin>("StickerNfc");

type NdefWriter = { write(message: { records: { recordType: "url"; data: string }[] }, options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void> };
type NdefWindow = Window & { NDEFReader?: new () => NdefWriter };

export type WriteFailure = "cancelled" | "blocked" | "nfc_off" | "locked" | "too_small" | "not_writable" | "failed";

/** "native" in the apps (iPhone shows its own scan sheet), "web" in Chrome on Android, or null. */
export type WriterKind = "native" | "web" | null;

export async function stickerWriter(): Promise<WriterKind> {
  if (Capacitor.isNativePlatform()) {
    try {
      return (await StickerNfc.isAvailable()).available ? "native" : null;
    } catch {
      return null; // An app build from before sticker writing.
    }
  }
  return typeof window !== "undefined" && typeof (window as NdefWindow).NDEFReader === "function" ? "web" : null;
}

const KNOWN: WriteFailure[] = ["cancelled", "blocked", "nfc_off", "locked", "too_small", "not_writable", "failed"];

function failure(f: WriteFailure): Error {
  return Object.assign(new Error(f), { failure: f });
}

/** Waits for a sticker to be held to the phone and writes the link to it. Rejects with a WriteFailure. */
export async function writeStickerLink(kind: Exclude<WriterKind, null>, url: string, placeName: string, signal: AbortSignal): Promise<void> {
  if (kind === "native") {
    const onAbort = () => void StickerNfc.cancel().catch(() => {});
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      await StickerNfc.writeUrl({
        url,
        prompt: `Hold the top of your iPhone near the sticker for ${placeName}.`,
        doneMessage: `Sticker linked to ${placeName}`,
      });
    } catch (e) {
      const code = (e as { code?: string })?.code as WriteFailure | undefined;
      throw failure(code && KNOWN.includes(code) ? code : "failed");
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
    return;
  }
  const Reader = (window as NdefWindow).NDEFReader;
  if (!Reader) throw failure("failed");
  try {
    await new Reader().write({ records: [{ recordType: "url", data: url }] }, { signal, overwrite: true });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    throw failure(name === "AbortError" ? "cancelled" : name === "NotAllowedError" ? "blocked" : "failed");
  }
}

export function writeFailure(e: unknown): WriteFailure {
  return (e as { failure?: WriteFailure })?.failure ?? "failed";
}

/** What to tell someone when a write didn't work. */
export function failureMessage(f: WriteFailure): string {
  switch (f) {
    case "blocked":
      return "Your phone didn't allow NFC. Check NFC is switched on in Settings, and allow it for this site when asked.";
    case "nfc_off":
      return "NFC is switched off. Turn it on in your phone's Settings, then try again.";
    case "locked":
      return "That sticker is locked, so it can't be changed. Use a fresh one.";
    case "too_small":
      return "That sticker is too small to hold the link. NTAG213 or bigger works.";
    case "not_writable":
      return "That sticker can't hold a link. Use an NTAG213, NTAG215 or NTAG216 sticker.";
    default:
      return "That didn't write. Hold the sticker still against your phone until it says it's done, then try again.";
  }
}
