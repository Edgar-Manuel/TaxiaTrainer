import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isDemoMode, supabaseConfig } from "@/lib/config";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Server Supabase client bound to the request cookies. Null in demo mode. */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  if (isDemoMode) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; middleware refreshes sessions.
        }
      },
    },
  });
}
