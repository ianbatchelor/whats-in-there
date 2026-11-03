import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, isConfigured } from "@/lib/config";

let client: SupabaseClient | null = null;

/** One browser client for the whole app. Sessions persist in localStorage (web and native WebView). */
export function supabase(): SupabaseClient {
  if (!isConfigured) {
    throw new Error("Supabase is not configured. Copy .env.example to .env.local and fill it in.");
  }
  client ??= createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" },
  });
  return client;
}
