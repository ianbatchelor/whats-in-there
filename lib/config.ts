/** Public configuration, read once. Values are inlined at build time by Next.js. */
export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, ""),
};

export const isConfigured = Boolean(config.supabaseUrl && config.supabaseKey);

/**
 * The public web origin used in links people share (invitations, sticker URLs).
 * Inside the native app window.location is capacitor://localhost, so the configured URL wins.
 */
export function publicOrigin(): string {
  if (config.appUrl) return config.appUrl;
  if (typeof window !== "undefined" && window.location.protocol.startsWith("http")) return window.location.origin;
  return "https://seewhatsinhere.com";
}

/** Where people write for help, shown on the Help, Privacy and Terms pages. */
export const SUPPORT_EMAIL = "seewhatsinhere@findthecool.com"; // an ImprovMX alias on findthecool.com

/**
 * The app's Apple id once it is on the public App Store (App Store Connect > App Information > Apple ID,
 * a number like "6739123456"). While it is empty, sticker pages say "Coming soon to the App Store" and
 * there is no Smart App Banner. Setting it switches on the App Store button and the banner.
 */
export const APP_STORE_ID = "";

/** The App Store page for the app, or null while it isn't on the public App Store yet. */
export function appStoreUrl(id: string = APP_STORE_ID): string | null {
  return /^\d+$/.test(id) ? `https://apps.apple.com/app/id${id}` : null;
}
