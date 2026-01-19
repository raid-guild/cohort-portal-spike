import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";
import { COHORT_ENTITLEMENT } from "@/lib/stripe";

export const runtime = "nodejs";

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const expiresAt = addDays(new Date(), 30).toISOString();
  const { error } = await admin
    .from("entitlements")
    .upsert(
      {
        user_id: userData.user.id,
        entitlement: COHORT_ENTITLEMENT,
        status: "active",
        expires_at: expiresAt,
        metadata: {
          source: "crypto-mock",
          granted_at: new Date().toISOString(),
        },
      },
      { onConflict: "user_id,entitlement" },
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, expires_at: expiresAt });
}
