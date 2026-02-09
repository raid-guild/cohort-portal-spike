import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

type Visibility = "public" | "authenticated" | "private";
type Kind = "note" | "milestone" | "attendance";

type TimelineEntry = {
  id: string;
  kind: Kind;
  title: string;
  body: string | null;
  visibility: Visibility;
  occurredAt: string;
  pinned: boolean;
  createdBy: string | null;
  createdViaRole: string | null;
};

type PatchEntryRequest = {
  title?: string;
  body?: string;
  visibility?: Visibility;
  occurredAt?: string;
  pinned?: boolean;
  kind?: Kind;
};

function normalizeVisibility(value: unknown): Visibility | null {
  return value === "public" || value === "authenticated" || value === "private"
    ? value
    : null;
}

function normalizeKind(value: unknown): Kind | null {
  return value === "note" || value === "milestone" || value === "attendance"
    ? value
    : null;
}

function toPayload(row: {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  visibility: string;
  occurred_at: string;
  pinned: boolean;
  created_by: string | null;
  created_via_role: string | null;
}): TimelineEntry {
  return {
    id: row.id,
    kind: normalizeKind(row.kind) ?? "note",
    title: row.title,
    body: row.body,
    visibility: normalizeVisibility(row.visibility) ?? "private",
    occurredAt: row.occurred_at,
    pinned: row.pinned,
    createdBy: row.created_by,
    createdViaRole: row.created_via_role,
  };
}

async function getViewerIdFromAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

async function assertOwner(entryId: string, viewerId: string) {
  const supabase = supabaseAdminClient();
  const { data, error } = await supabase
    .from("timeline_entries")
    .select("id, user_id")
    .eq("id", entryId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { ok: false as const, status: 404 as const, error: "Not found." };
  }
  if (data.user_id !== viewerId) {
    return { ok: false as const, status: 403 as const, error: "Forbidden." };
  }
  return { ok: true as const };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const viewerId = await getViewerIdFromAuthHeader(request);
  if (!viewerId) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }
  const { id } = params;

  const ownerCheck = await assertOwner(id, viewerId);
  if (!ownerCheck.ok) {
    return Response.json({ error: ownerCheck.error }, { status: ownerCheck.status });
  }

  let body: PatchEntryRequest;
  try {
    body = (await request.json()) as PatchEntryRequest;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return Response.json({ error: "Title is required." }, { status: 400 });
    }
    if (title.length > 120) {
      return Response.json({ error: "Title is too long." }, { status: 400 });
    }
    payload.title = title;
  }

  if (typeof body.body === "string") {
    const content = body.body.trim();
    if (content.length > 1000) {
      return Response.json({ error: "Body is too long." }, { status: 400 });
    }
    payload.body = content.length ? content : null;
  }

  const visibility = normalizeVisibility(body.visibility);
  if (visibility) {
    payload.visibility = visibility;
  }

  const kind = normalizeKind(body.kind);
  if (kind) {
    payload.kind = kind;
  }

  if (typeof body.pinned === "boolean") {
    payload.pinned = body.pinned;
  }

  if (typeof body.occurredAt === "string" && body.occurredAt.trim()) {
    const date = new Date(body.occurredAt);
    if (Number.isNaN(date.getTime())) {
      return Response.json({ error: "Invalid occurredAt." }, { status: 400 });
    }
    payload.occurred_at = date.toISOString();
  }

  if (!Object.keys(payload).length) {
    return Response.json({ error: "No updates provided." }, { status: 400 });
  }

  const supabase = supabaseAdminClient();
  const { data, error } = await supabase
    .from("timeline_entries")
    .update(payload)
    .eq("id", id)
    .select(
      "id, kind, title, body, visibility, occurred_at, pinned, created_by, created_via_role",
    )
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ item: toPayload(data) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const viewerId = await getViewerIdFromAuthHeader(request);
  if (!viewerId) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }
  const { id } = params;

  const ownerCheck = await assertOwner(id, viewerId);
  if (!ownerCheck.ok) {
    return Response.json({ error: ownerCheck.error }, { status: ownerCheck.status });
  }

  const supabase = supabaseAdminClient();
  const { error } = await supabase
    .from("timeline_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
