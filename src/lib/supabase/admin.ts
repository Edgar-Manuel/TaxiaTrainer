import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-side jobs (importer, admin API routes).
 * Never import this from client components.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL son necesarios para operaciones de administración",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
