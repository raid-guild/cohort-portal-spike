import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

let browserClient: SupabaseClient<Database> | null = null;

export const supabaseBrowserClient = () => {
  // During `next build`, client components can be pre-rendered in a Node context.
  // We don't want the build to fail just because public env vars aren't present.
  // In the browser, still fail loudly if misconfigured.
  const url = supabaseUrl || "http://localhost:54321";
  const key = supabasePublishableKey || "missing-supabase-publishable-key";

  if (!supabaseUrl || !supabasePublishableKey) {
    if (typeof window !== "undefined") {
      throw new Error("Missing Supabase environment variables.");
    }
  }

  if (!browserClient) {
    browserClient = createClient<Database>(url, key);
  }
  return browserClient;
};
