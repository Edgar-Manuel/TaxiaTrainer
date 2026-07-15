"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isDemoMode, supabaseConfig } from "@/lib/config";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Browser Supabase client. Returns null in demo mode (no credentials). */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (isDemoMode) return null;
  client ??= createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
  return client;
}
