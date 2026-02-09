import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

// Allow SUPABASE_URL, but fall back to NEXT_PUBLIC_SUPABASE_URL so Preview builds don't
// need to duplicate the URL in two variables.
const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseAdminClient = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};
