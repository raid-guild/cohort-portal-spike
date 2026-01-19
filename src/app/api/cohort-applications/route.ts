import { NextRequest } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";

type ApplicationPayload = {
  intent: string;
  goals: string;
  timeCommitment: string;
  workInterest: string;
  pastWork?: string | null;
};

const requireUser = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token." } as const;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid auth token." } as const;
  }
  return { user: data.user } as const;
};

export async function GET(request: NextRequest) {
  const result = await requireUser(request);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("cohort_applications")
    .select("*")
    .eq("user_id", result.user.id)
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ application: data });
}

export async function POST(request: NextRequest) {
  const result = await requireUser(request);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  let payload: ApplicationPayload;
  try {
    payload = (await request.json()) as ApplicationPayload;
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { intent, goals, timeCommitment, workInterest, pastWork } = payload;
  if (!intent || !goals || !timeCommitment || !workInterest) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const admin = supabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("cohort_applications")
    .select("id")
    .eq("user_id", result.user.id)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return Response.json({ error: existingError.message }, { status: 500 });
  }
  if (existing) {
    return Response.json(
      { error: "Application already submitted." },
      { status: 409 },
    );
  }

  const { data, error } = await admin
    .from("cohort_applications")
    .insert({
      user_id: result.user.id,
      intent,
      goals,
      time_commitment: timeCommitment,
      work_interest: workInterest,
      past_work: pastWork?.trim() ? pastWork.trim() : null,
      status: "submitted",
      signal_check_status: "pending",
      payment_status: "unpaid",
    })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ application: data });
}
