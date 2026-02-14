import { NextRequest } from "next/server";
import type { Json } from "@/lib/types/db";
import { requireAuth } from "../../_auth";

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

  const { data: existing, error: existingError } = await admin
    .from("module_requests")
    .select("id, created_by, status, title, module_id, spec")
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
    return Response.json({ error: "Only the creator can publish." }, { status: 403 });
  }
  if (existing.status !== "draft") {
    return Response.json({ error: "Only draft requests can be published." }, { status: 400 });
  }

  const spec = existing.spec as Json;
  const getField = (key: string) => {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) return "";
    const record = spec as Record<string, Json | undefined>;
    return typeof record[key] === "string" ? record[key].trim() : "";
  };

  const required = [
    ["problem", getField("problem")],
    ["scope", getField("scope")],
    ["ux", getField("ux")],
  ] as const;
  const missing = required
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const missingFields = [
    ...(existing.title?.trim() ? [] : ["title"]),
    ...(existing.module_id?.trim() ? [] : ["module_id"]),
    ...missing,
  ];

  if (missingFields.length) {
    return Response.json(
      {
        error: `Missing required fields: ${missingFields.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("module_requests")
    .update({ status: "open" })
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
