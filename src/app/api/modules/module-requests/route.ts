import { NextRequest } from "next/server";
import type { TablesInsert } from "@/lib/types/db";
import { requireAuth } from "./_auth";
import { normalizeStatus, type ModuleRequestSpec } from "./lib";

const parseSort = (value: string | null) => {
  const sort = (value ?? "").trim();
  if (sort === "trending" || sort === "ready" || sort === "new") return sort;
  return "new";
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 400 });
  }

  const url = new URL(request.url);
  const status = normalizeStatus(url.searchParams.get("status"));
  const sort = parseSort(url.searchParams.get("sort"));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const admin = auth.admin;

  let query = admin
    .from("module_requests")
    .select(
      "id, created_by, module_id, title, owner_contact, status, spec, votes_count, promotion_threshold, github_issue_url, submitted_to_github_at, created_at, updated_at",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (status) {
    query = query.eq("status", status);
  } else {
    // Default to open-ish states
    query = query.in("status", ["open", "ready"]);
  }

  if (sort === "trending") {
    query = query.order("votes_count", { ascending: false }).order("updated_at", { ascending: false });
  } else if (sort === "ready") {
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Determine viewer votes for returned rows.
  const ids = (data ?? []).map((row) => row.id);
  let votedIds = new Set<string>();
  if (ids.length) {
    const { data: voteRows } = await admin
      .from("module_request_votes")
      .select("request_id")
      .eq("user_id", auth.userId)
      .in("request_id", ids);

    votedIds = new Set((voteRows ?? []).map((row) => row.request_id));
  }

  return Response.json({
    items: (data ?? []).map((row) => ({
      ...row,
      viewer_has_voted: votedIds.has(row.id),
    })),
    page,
    limit,
    total: count ?? null,
  });
}

type CreateRequestBody = {
  title?: string;
  module_id?: string;
  owner_contact?: string;
  spec?: ModuleRequestSpec;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 400 });
  }

  let body: CreateRequestBody;
  try {
    body = (await request.json()) as CreateRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const moduleId = String(body.module_id ?? "").trim();
  if (!title) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }
  if (!moduleId) {
    return Response.json({ error: "module_id is required." }, { status: 400 });
  }

  const insert: TablesInsert<"module_requests"> = {
    created_by: auth.userId,
    title,
    module_id: moduleId,
    owner_contact: typeof body.owner_contact === "string" ? body.owner_contact.trim() : null,
    status: "draft",
    spec: (body.spec ?? {}) as ModuleRequestSpec,
  };

  const { data, error } = await auth.admin
    .from("module_requests")
    .insert(insert)
    .select(
      "id, created_by, module_id, title, owner_contact, status, spec, votes_count, promotion_threshold, github_issue_url, submitted_to_github_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ item: data });
}
