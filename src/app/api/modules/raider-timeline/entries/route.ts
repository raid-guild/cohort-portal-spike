import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/db";
import {
  getViewerIdFromAuthHeader,
  normalizeKind,
  normalizeVisibility,
  toPayload,
  type Kind,
  type TimelineEntry,
  type Visibility,
} from "@/app/api/modules/raider-timeline/lib";

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const handle = String(url.searchParams.get("handle") ?? "").trim();
  if (!handle) {
    return Response.json({ error: "Missing handle." }, { status: 400 });
  }

  const viewerId = await getViewerIdFromAuthHeader(request);

  let userId: string | null;
  try {
    userId = await getUserIdForHandle(handle);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve handle.";
    return Response.json({ error: message }, { status: 500 });
  }

  if (!userId) {
    return Response.json({ items: [] satisfies TimelineEntry[] });
  }

  const supabase = supabaseAdminClient();
  let visibilityFilter: Visibility[] = ["public"];
  if (viewerId) {
    visibilityFilter =
      viewerId === userId
        ? ["public", "authenticated", "private"]
        : ["public", "authenticated"];
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

  let body: CreateEntryRequest;
  try {
    body = (await request.json()) as CreateEntryRequest;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

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

  const visibility = normalizeVisibility(body.visibility, "private");
  const kind = normalizeKind(body.kind, "note");

  let occurredAt: string;
  if (body.occurredAt) {
    const date = new Date(body.occurredAt);
    if (Number.isNaN(date.getTime())) {
      return Response.json({ error: "Invalid occurredAt." }, { status: 400 });
    }
    occurredAt = date.toISOString();
  } else {
    occurredAt = new Date().toISOString();
  }

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
