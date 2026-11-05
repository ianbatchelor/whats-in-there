import { supabase } from "@/lib/supabase/client";
import { todayIso } from "@/lib/domain/dates";
import { readLabel, type LabelReading } from "@/lib/domain/extraction";
import { thumbPath } from "@/lib/itemPhotos";

const LONG_EDGE = 1600;
const THUMB_EDGE = 240;
const BUCKET = "item-photos";

/**
 * Shrinks a camera photo before it leaves the phone: longest side 1600px, WebP where the browser can
 * encode it (JPEG otherwise, e.g. older Safari). Labels stay sharp and uploads stay small.
 */
export async function shrinkPhoto(file: Blob, longEdge = LONG_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", 0.85);
  if (!jpeg) throw new Error("photo_failed");
  return jpeg;
}

/**
 * Uploads the photo into the household's private folder and returns its storage path. With
 * `withThumb`, a small square-ish copy for item lists goes beside it (see `thumbPath`); if that
 * copy fails the item simply shows the full photo instead.
 */
export async function uploadLabelPhoto(householdId: string, photo: Blob, withThumb = false): Promise<string> {
  const ext = photo.type === "image/webp" ? "webp" : "jpg";
  const path = `${householdId}/labels/${crypto.randomUUID()}.${ext}`;
  const bucket = supabase().storage.from(BUCKET);
  const { error } = await bucket.upload(path, photo, { contentType: photo.type, upsert: false });
  if (error) throw error;
  if (withThumb) {
    try {
      const small = await shrinkPhoto(photo, THUMB_EDGE);
      await bucket.upload(thumbPath(path), small, { contentType: small.type, upsert: false });
    } catch {
      /* the list falls back to the full photo */
    }
  }
  return path;
}

/** Removes photos that won't be kept (and their small copies), e.g. when the person cancels or retakes. Never throws. */
export async function discardLabelPhoto(...paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    await supabase().storage.from(BUCKET).remove(paths.flatMap((p) => [p, thumbPath(p)]));
  } catch {
    /* an orphaned photo is harmless and stays private */
  }
}

export type ReadResult = { ok: true; reading: LabelReading } | { ok: false; code: string };

/**
 * Asks the extract-product function to read the uploaded photos of one pack (front first, then back
 * or side), then checks every value it returns.
 */
export async function readLabelPhoto(householdId: string, imagePaths: string[]): Promise<ReadResult> {
  const { data, error } = await supabase().functions.invoke("extract-product", {
    // imagePath keeps an older deployment of the function working (it reads the first photo only).
    body: { householdId, imagePaths, imagePath: imagePaths[0] },
  });
  if (error) {
    let code = "failed";
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      // 404 means the function hasn't been deployed yet.
      if (ctx.status === 404) code = "not_configured";
      else {
        try {
          code = String((await ctx.json())?.error ?? "failed");
        } catch {
          /* not JSON: the function crashed */
        }
      }
    }
    return { ok: false, code };
  }
  const reading = readLabel((data as { reading?: unknown } | null)?.reading, todayIso());
  return reading ? { ok: true, reading } : { ok: false, code: "unreadable" };
}
