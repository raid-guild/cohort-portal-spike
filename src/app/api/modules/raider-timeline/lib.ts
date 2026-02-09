import { NextRequest } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";

export type Visibility = "public" | "authenticated" | "private";
export type Kind = "note" | "milestone" | "attendance";

export type TimelineEntry = {
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

export function parseVisibility(value: unknown): Visibility | null {
  return value === "public" || value === "authenticated" || value === "private"
    ? value
    : null;
}

export function parseKind(value: unknown): Kind | null {
  return value === "note" || value === "milestone" || value === "attendance"
    ? value
    : null;
}

export function normalizeVisibility(value: unknown, fallback: Visibility): Visibility {
  return parseVisibility(value) ?? fallback;
}

export function normalizeKind(value: unknown, fallback: Kind): Kind {
  return parseKind(value) ?? fallback;
}

export function toPayload(row: {
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
    kind: normalizeKind(row.kind, "note"),
    title: row.title,
    body: row.body,
    visibility: normalizeVisibility(row.visibility, "private"),
    occurredAt: row.occurred_at,
    pinned: row.pinned,
    createdBy: row.created_by,
    createdViaRole: row.created_via_role,
  };
}

export async function getViewerIdFromAuthHeader(
  request: NextRequest,
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}
