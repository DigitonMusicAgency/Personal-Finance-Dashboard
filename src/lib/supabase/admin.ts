import { createClient } from "@supabase/supabase-js";

// Admin client using service_role key — bypasses RLS completely.
// ONLY use this server-side (API routes, server actions). Never expose to browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
