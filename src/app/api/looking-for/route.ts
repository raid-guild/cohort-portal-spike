import { NextRequest } from "next/server";
import { requireAuth } from "./_auth";

const TYPE_VALUES = new Set(["looking_for", "offering"]);
const STATUS_VALUES = new Set(["open", "fulfilled", "closed"]);

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const type = request.nextUrl.searchParams.get("type");
  const status = request.nextUrl.searchParams.get("status");
  const category = request.nextUrl.searchParams.get("category");
  const tag = request.nextUrl.searchParams.get("tag");

  let query = auth.admin
    .from("looking_for_listings" as any)
    .select(
      "id, type, title, description, category, tags, status, created_by, contact_method, external_contact, created_at, updated_at, fulfilled_at",
    )
    .order("updated_at", { ascending: false });

  if (type) {
    if (!TYPE_VALUES.has(type)) {
      return Response.json({ error: "Invalid type filter." }, { status: 400 });
    }
    query = query.eq("type", type);
  }

  if (status) {
    if (!STATUS_VALUES.has(status)) {
      return Response.json({ error: "Invalid status filter." }, { status: 400 });
    }
    query = query.eq("status", status);
  }

  if (category) {
    query = query.eq("category", category);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ listings: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const type = String(body?.type ?? "").trim();
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category = body?.category ? String(body.category).trim() : null;
  const tags = Array.isArray(body?.tags)
    ? (body.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean)
    : null;
  const contactMethod = String(body?.contact_method ?? body?.contactMethod ?? "profile").trim();
  const externalContact = body?.external_contact
    ? String(body.external_contact).trim()
    : body?.externalContact
      ? String(body.externalContact).trim()
      : null;

  if (!TYPE_VALUES.has(type)) {
    return Response.json({ error: "type must be looking_for or offering." }, { status: 400 });
  }
  if (!title) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("looking_for_listings" as any)
    .insert({
      type,
      title,
      description,
      category,
      tags,
      status: "open",
      created_by: auth.userId,
      contact_method: contactMethod,
      external_contact: externalContact,
    })
    .select(
      "id, type, title, description, category, tags, status, created_by, contact_method, external_contact, created_at, updated_at, fulfilled_at",
    )
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ listing: data });
}
