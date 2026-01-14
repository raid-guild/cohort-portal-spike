import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseServerClient = () => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables.");
  }
  return createClient<Database>(supabaseUrl, supabasePublishableKey);
};
