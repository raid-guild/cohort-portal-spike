import { NextRequest } from "next/server";
import type { TablesUpdate } from "@/lib/types/db";
import { requireAuth } from "../_auth";
import type { ModuleRequestSpec } from "../lib";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 400 });
  }

  const { id } = await params;
  const admin = auth.admin;

  const { data, error } = await admin
    .from("module_requests")
    .select(
      "id, created_by, module_id, title, owner_contact, status, spec, votes_count, promotion_threshold, github_issue_url, submitted_to_github_at, created_at, updated_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const { data: voteRow, error: voteError } = await admin
    .from("module_request_votes")
    .select("request_id")
    .eq("request_id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (voteError) {
    return Response.json({ error: voteError.message }, { status: 500 });
  }

  return Response.json({ item: { ...data, viewer_has_voted: Boolean(voteRow) } });
}

type PatchBody = {
  title?: string;
  module_id?: string;
  owner_contact?: string | null;
  spec?: ModuleRequestSpec;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 400 });
  }

  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const admin = auth.admin;

  // Ensure the viewer can edit (creator + draft)
  const { data: existing, error: existingError } = await admin
    .from("module_requests")
    .select("id, created_by, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    return Response.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (existing.created_by !== auth.userId) {
    return Response.json({ error: "Only the creator can edit this request." }, { status: 403 });
  }
  if (existing.status !== "draft") {
    return Response.json({ error: "Only draft requests can be edited." }, { status: 403 });
  }

  const update: TablesUpdate<"module_requests"> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return Response.json({ error: "Title is required." }, { status: 400 });
    }
    update.title = title;
  }
  if (typeof body.module_id === "string") {
    const moduleId = body.module_id.trim();
    if (!moduleId) {
      return Response.json({ error: "module_id is required." }, { status: 400 });
    }
    update.module_id = moduleId;
  }
  if (body.owner_contact === null) {
    update.owner_contact = null;
  } else if (typeof body.owner_contact === "string") {
    update.owner_contact = body.owner_contact.trim() || null;
  }
  if (body.spec && typeof body.spec === "object" && !Array.isArray(body.spec)) {
    update.spec = body.spec as ModuleRequestSpec;
  }

  const { data, error } = await admin
    .from("module_requests")
    .update(update)
    .eq("id", id)
    .select(
      "id, created_by, module_id, title, owner_contact, status, spec, votes_count, promotion_threshold, github_issue_url, submitted_to_github_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ item: data });
}
