import { NextRequest } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";

const formatStatus = (value?: string | null) => {
  if (!value) return "Not submitted";
  return value.replace(/_/g, " ");
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { title: "Application", items: [{ label: "Status", value: "Sign in" }] },
      { status: 401 },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json(
      { title: "Application", items: [{ label: "Status", value: "Sign in" }] },
      { status: 401 },
    );
  }

  const admin = supabaseAdminClient();
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "host")
    .maybeSingle();

  if (roleRow) {
    const { data: rows, error: countError } = await admin
      .from("cohort_applications")
      .select("status");

    if (countError) {
      return Response.json(
        { title: "Applications", items: [{ label: "Status", value: "Unavailable" }] },
        { status: 500 },
      );
    }

    const counts = (rows ?? []).reduce(
      (acc, row) => {
        const status = row.status ?? "submitted";
        if (status === "approved") acc.approved += 1;
        else if (status === "rejected") acc.rejected += 1;
        else acc.pending += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 },
    );

    return Response.json({
      title: "Applications",
      items: [
        { label: "Pending review", value: String(counts.pending) },
        { label: "Approved", value: String(counts.approved) },
        { label: "Rejected", value: String(counts.rejected) },
      ],
    });
  }

  const { data, error } = await admin
    .from("cohort_applications")
    .select("status, signal_check_status, applied_at")
    .eq("user_id", userData.user.id)
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json(
      { title: "Application", items: [{ label: "Status", value: "Unavailable" }] },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json({
      title: "Application",
      items: [
        { label: "Status", value: "Not submitted" },
        { label: "Next step", value: "Apply to join the cohort." },
      ],
    });
  }

  return Response.json({
    title: "Application",
    items: [
      { label: "Status", value: formatStatus(data.status) },
      { label: "Signal check", value: formatStatus(data.signal_check_status) },
      {
        label: "Applied",
        value: data.applied_at ? new Date(data.applied_at).toLocaleDateString() : "—",
      },
    ],
  });
}
