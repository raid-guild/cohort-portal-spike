import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ entitlements: [] });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ entitlements: [] });
  }

  const admin = supabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("entitlements")
    .select("entitlement, status, metadata, expires_at")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error || !data) {
    return Response.json({ entitlements: [] });
  }

  return Response.json({
    entitlements: data.map((row) => row.entitlement),
    records: data,
  });
}
