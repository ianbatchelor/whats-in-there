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
