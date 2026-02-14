import { NextRequest } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "../../_auth";

type AdminClient = ReturnType<typeof supabaseAdminClient>;

async function loadRequest(admin: AdminClient, id: string) {
  const { data, error } = await admin
    .from("module_requests")
    .select(
      "id, created_by, module_id, title, owner_contact, status, spec, votes_count, promotion_threshold, github_issue_url, submitted_to_github_at, created_at, updated_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === "23505";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 400 });
  }

  const { id } = await params;
  const admin = auth.admin;

  let existing;
  try {
    existing = await loadRequest(admin, id);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error." },
      { status: 500 },
    );
  }

  if (!existing) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!(existing.status === "open" || existing.status === "ready")) {
    return Response.json(
      { error: "Voting is only allowed for open/ready requests." },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("module_request_votes")
    .insert({ request_id: id, user_id: auth.userId });

  if (error) {
    // Unique violation from composite PK
    if (isUniqueViolation(error)) {
      return Response.json({ error: "You have already voted." }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  let updated;
  try {
    updated = await loadRequest(admin, id);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error." },
      { status: 500 },
    );
  }

  return Response.json({ item: { ...updated, viewer_has_voted: true } });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 400 });
  }

  const { id } = await params;
  const admin = auth.admin;

  const { error } = await admin
    .from("module_request_votes")
    .delete()
    .eq("request_id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let updated;
  try {
    updated = await loadRequest(admin, id);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error." },
      { status: 500 },
    );
  }

  if (!updated) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  return Response.json({ item: { ...updated, viewer_has_voted: false } });
}
