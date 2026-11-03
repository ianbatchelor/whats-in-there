import { supabase } from "@/lib/supabase/client";
import { todayIso } from "@/lib/domain/dates";
import { readLabel, type LabelReading } from "@/lib/domain/extraction";

const LONG_EDGE = 1600;
const BUCKET = "item-photos";

/**
 * Shrinks a camera photo before it leaves the phone: longest side 1600px, WebP where the browser can
 * encode it (JPEG otherwise, e.g. older Safari). Labels stay sharp and uploads stay small.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
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

/** Uploads the photo into the household's private folder. Returns its storage path. */
export async function uploadLabelPhoto(householdId: string, photo: Blob): Promise<string> {
  const ext = photo.type === "image/webp" ? "webp" : "jpg";
  const path = `${householdId}/labels/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase().storage.from(BUCKET).upload(path, photo, { contentType: photo.type, upsert: false });
  if (error) throw error;
  return path;
}

/** Removes a photo that won't be kept, e.g. when the person cancels or retakes. Never throws. */
export async function discardLabelPhoto(path: string): Promise<void> {
  try {
    await supabase().storage.from(BUCKET).remove([path]);
  } catch {
    /* an orphaned photo is harmless and stays private */
  }
}

export type ReadResult = { ok: true; reading: LabelReading } | { ok: false; code: string };

/** Asks the extract-product function to read the uploaded label, then checks every value it returns. */
export async function readLabelPhoto(householdId: string, imagePath: string): Promise<ReadResult> {
  const { data, error } = await supabase().functions.invoke("extract-product", { body: { householdId, imagePath } });
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
