import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/cohorts/lib";
import { supabaseAdminClient } from "@/lib/supabase/admin";

const formatRange = (startAt: string | null, endAt: string | null) => {
  if (!startAt && !endAt) return "Dates TBD";
  const start = startAt ? new Date(startAt).toLocaleDateString("en-US") : "TBD";
  const end = endAt ? new Date(endAt).toLocaleDateString("en-US") : "TBD";
  return `${start} -> ${end}`;
};

export async function GET(request: NextRequest) {
  const result = await requireUser(request);
  if ("error" in result) {
    return Response.json({
      title: "Cohort Hub",
      items: [{ label: "Status", value: "Sign in" }],
    });
  }

  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("cohorts")
    .select("id, slug, name, start_at, end_at")
    .eq("status", "active")
    .order("start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({
      title: "Cohort Hub",
      items: [{ label: "Status", value: "Summary unavailable" }],
    });
  }

  if (!data) {
    return Response.json({
      title: "Cohort Hub",
      items: [{ label: "Active cohort", value: "None" }],
    });
  }

  const landingPath = `/cohorts/${data.slug || data.id}`;
  return Response.json({
    title: "Cohort Hub",
    items: [
      { label: "Active cohort", value: data.name },
      { label: "Dates", value: formatRange(data.start_at, data.end_at) },
      { label: "Landing page", value: landingPath },
    ],
  });
}
