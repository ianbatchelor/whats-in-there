/**
 * Writing a sticker link from the browser with Web NFC. Only Chrome on Android supports it;
 * iPhones need the installed app (Apple doesn't let websites use NFC).
 */
type NdefWriter = { write(message: { records: { recordType: "url"; data: string }[] }, options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void> };
type NdefWindow = Window & { NDEFReader?: new () => NdefWriter };

export function canWriteStickersHere(): boolean {
  return typeof window !== "undefined" && typeof (window as NdefWindow).NDEFReader === "function";
}

export type WriteFailure = "cancelled" | "blocked" | "failed";

/** Waits for a sticker to be held to the phone and writes the link to it. */
export async function writeStickerLink(url: string, signal: AbortSignal): Promise<void> {
  const Reader = (window as NdefWindow).NDEFReader;
  if (!Reader) throw Object.assign(new Error("unsupported"), { failure: "failed" as WriteFailure });
  try {
    await new Reader().write({ records: [{ recordType: "url", data: url }] }, { signal, overwrite: true });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    const failure: WriteFailure = name === "AbortError" ? "cancelled" : name === "NotAllowedError" ? "blocked" : "failed";
    throw Object.assign(new Error(failure), { failure });
  }
}

export function writeFailure(e: unknown): WriteFailure {
  return (e as { failure?: WriteFailure })?.failure ?? "failed";
}
