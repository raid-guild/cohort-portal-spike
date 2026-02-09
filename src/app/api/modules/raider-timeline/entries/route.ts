import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/db";

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

function normalizeVisibility(value: unknown): Visibility {
  return value === "public" || value === "authenticated" || value === "private"
    ? value
    : "private";
}

function normalizeKind(value: unknown): Kind {
  return value === "note" || value === "milestone" || value === "attendance"
    ? value
    : "note";
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

async function getUserIdForHandle(handle: string) {
  const supabase = supabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("handle", handle)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data?.user_id ?? null;
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
    kind: normalizeKind(row.kind),
    title: row.title,
    body: row.body,
    visibility: normalizeVisibility(row.visibility),
    occurredAt: row.occurred_at,
    pinned: row.pinned,
    createdBy: row.created_by,
    createdViaRole: row.created_via_role,
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const handle = String(url.searchParams.get("handle") ?? "").trim();
  if (!handle) {
    return Response.json({ error: "Missing handle." }, { status: 400 });
  }

  const viewerId = await getViewerIdFromAuthHeader(request);
  const userId = await getUserIdForHandle(handle);
  if (!userId) {
    return Response.json({ items: [] satisfies TimelineEntry[] });
  }

  const supabase = supabaseAdminClient();
  let visibilityFilter: Visibility[] = ["public"];
  if (viewerId) {
    visibilityFilter = viewerId === userId ? ["public", "authenticated", "private"] : ["public", "authenticated"];
  }

  const { data, error } = await supabase
    .from("timeline_entries")
    .select(
      "id, kind, title, body, visibility, occurred_at, pinned, created_by, created_via_role",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("visibility", visibilityFilter)
    .order("pinned", { ascending: false })
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ items: (data ?? []).map(toPayload) });
}

type CreateEntryRequest = {
  userHandle?: string;
  kind?: Kind;
  title?: string;
  body?: string;
  visibility?: Visibility;
  occurredAt?: string;
  pinned?: boolean;
  sourceKind?: string;
  sourceRef?: unknown;
};

export async function POST(request: NextRequest) {
  const viewerId = await getViewerIdFromAuthHeader(request);
  if (!viewerId) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const body = (await request.json()) as CreateEntryRequest;

  if (body.userHandle) {
    return Response.json(
      { error: "Host-mode entry creation is not available in Phase 0." },
      { status: 403 },
    );
  }

  const title = String(body.title ?? "").trim();
  if (!title) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }
  if (title.length > 120) {
    return Response.json({ error: "Title is too long." }, { status: 400 });
  }

  const rawBody = typeof body.body === "string" ? body.body.trim() : "";
  const content = rawBody.length ? rawBody : null;
  if (content && content.length > 1000) {
    return Response.json({ error: "Body is too long." }, { status: 400 });
  }

  const visibility = normalizeVisibility(body.visibility);
  const kind = normalizeKind(body.kind);

  const occurredAt = body.occurredAt ? new Date(body.occurredAt).toISOString() : new Date().toISOString();
  const pinned = Boolean(body.pinned);

  const supabase = supabaseAdminClient();
  const { data, error } = await supabase
    .from("timeline_entries")
    .insert({
      user_id: viewerId,
      kind,
      title,
      body: content,
      visibility,
      occurred_at: occurredAt,
      pinned,
      created_by: viewerId,
      created_via_role: null,
      source_kind: typeof body.sourceKind === "string" ? body.sourceKind : null,
      source_ref:
        body.sourceRef && typeof body.sourceRef === "object"
          ? (body.sourceRef as Json)
          : null,
    })
    .select(
      "id, kind, title, body, visibility, occurred_at, pinned, created_by, created_via_role",
    )
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ item: toPayload(data) });
}
