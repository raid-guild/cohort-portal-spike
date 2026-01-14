import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

let browserClient: SupabaseClient<Database> | null = null;

export const supabaseBrowserClient = () => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables.");
  }
  if (!browserClient) {
    browserClient = createClient<Database>(supabaseUrl, supabasePublishableKey);
  }
  return browserClient;
};
