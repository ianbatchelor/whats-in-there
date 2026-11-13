import { supabase } from "@/lib/supabase/client";
import { isIsbn } from "@/lib/domain/books";

/**
 * Finding books for the wish list. Title searches and barcode lookups go straight from the phone
 * to Open Library, the free public library catalogue the app already uses for book covers and
 * barcodes. Only the words typed (or the ISBN digits) are sent. Nothing here uses the AI reader,
 * so it never counts towards anyone's monthly scans.
 */

export type FoundBook = { title: string; author: string | null; coverId: number | null; year: number | null; isbn: string | null };

type Doc = { title?: unknown; subtitle?: unknown; author_name?: unknown; cover_i?: unknown; first_publish_year?: unknown };

function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim().slice(0, max) : null;
}

function toBook(d: Doc, isbn: string | null = null): FoundBook | null {
  const title = clean(d.title, 120);
  if (!title) return null;
  const authors = Array.isArray(d.author_name) ? d.author_name.map((a) => clean(a, 60)).filter((a): a is string => !!a) : [];
  const author = authors.length > 2 ? `${authors[0]} and others` : authors.join(" and ") || null;
  return {
    title,
    author,
    coverId: typeof d.cover_i === "number" && d.cover_i > 0 ? d.cover_i : null,
    year: typeof d.first_publish_year === "number" ? d.first_publish_year : null,
    isbn,
  };
}

async function search(params: Record<string, string>, signal?: AbortSignal): Promise<Doc[]> {
  const q = new URLSearchParams({ ...params, fields: "title,author_name,cover_i,first_publish_year" });
  const res = await fetch(`https://openlibrary.org/search.json?${q}`, { headers: { Accept: "application/json" }, signal });
  if (!res.ok) throw new Error("search_failed");
  const data = (await res.json()) as { docs?: Doc[] };
  return Array.isArray(data.docs) ? data.docs : [];
}

/** Up to six books matching a title (and author, if typed). */
export async function searchBooks(text: string, signal?: AbortSignal): Promise<FoundBook[]> {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 120);
  if (t.length < 3) return [];
  const docs = await search({ q: t, limit: "6" }, signal);
  const seen = new Set<string>();
  return docs
    .map((d) => toBook(d))
    .filter((b): b is FoundBook => {
      if (!b) return false;
      const key = `${b.title}|${b.author}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** A book from the ISBN under its barcode, or null when Open Library doesn't know it. */
export async function lookUpIsbn(isbn: string): Promise<FoundBook | null> {
  if (!isIsbn(isbn)) return null;
  const docs = await search({ isbn, limit: "1" });
  return docs[0] ? toBook(docs[0], isbn) : null;
}

/**
 * Reads the barcode in a photo of the back of a book, on the phone itself. Returns the ISBN, or
 * null when no book barcode could be read. The barcode reader only loads when it's first needed.
 */
export async function readBarcode(photo: Blob): Promise<string | null> {
  const zx = await import("@zxing/library");
  const bitmap = await createImageBitmap(photo, { imageOrientation: "from-image" });
  const hints = new Map<import("@zxing/library").DecodeHintType, unknown>([
    [zx.DecodeHintType.POSSIBLE_FORMATS, [zx.BarcodeFormat.EAN_13]],
    [zx.DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new zx.MultiFormatReader();
  reader.setHints(hints);
  try {
    // Try a couple of sizes and both ways up: phones take big photos, and barcodes run either way.
    for (const edge of [1400, 900, 2000]) {
      for (const turn of [0, 90]) {
        const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = turn ? h : w;
        canvas.height = turn ? w : h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        if (turn) {
          ctx.translate(h, 0);
          ctx.rotate(Math.PI / 2);
        }
        ctx.drawImage(bitmap, 0, 0, w, h);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const lum = new Uint8ClampedArray(width * height);
        for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (data[i]! * 77 + data[i + 1]! * 150 + data[i + 2]! * 29) >> 8;
        try {
          const source = new zx.RGBLuminanceSource(lum, width, height);
          const result = reader.decodeWithState(new zx.BinaryBitmap(new zx.HybridBinarizer(source)));
          const text = result.getText();
          if (isIsbn(text)) return text;
        } catch {
          // Not found at this size: try the next.
        }
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}

export type OwnedBook = { productName: string; brand: string | null; locationId: string };

/** The names of everything the household keeps, to spot wished-for books that are already on a shelf. */
export async function loadOwnedNames(householdId: string): Promise<OwnedBook[]> {
  const { data, error } = await supabase()
    .from("stock_items")
    .select("product_name, brand, location_id")
    .eq("household_id", householdId)
    .eq("status", "in_stock")
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((r) => ({ productName: r.product_name as string, brand: (r.brand as string | null) ?? null, locationId: r.location_id as string }));
}
