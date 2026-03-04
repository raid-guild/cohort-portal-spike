import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth";

const TYPE_VALUES = new Set(["looking_for", "offering"]);
const STATUS_VALUES = new Set(["open", "fulfilled", "closed"]);
const CONTACT_METHOD_VALUES = new Set(["profile", "dm", "external"]);

type ListingRow = {
  id: string;
  type: "looking_for" | "offering";
  title: string;
  description: string;
  category: string | null;
  tags: string[] | null;
  status: "open" | "fulfilled" | "closed";
  created_by: string;
  contact_method: "profile" | "dm" | "external";
  external_contact: string | null;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
};

type ListingAuthor = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function withListingAuthors(
  admin: SupabaseClient,
  rows: ListingRow[],
) {
  const userIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean)));
  const authorByUserId = new Map<string, ListingAuthor>();

  if (userIds.length) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("user_id,handle,display_name,avatar_url")
      .in("user_id", userIds);

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    for (const row of (profiles ?? []) as ListingAuthor[]) {
      if (row.user_id) {
        authorByUserId.set(row.user_id, row);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    author: authorByUserId.get(row.created_by) ?? null,
  }));
}

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
    .from("looking_for_listings")
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

  try {
    const listings = await withListingAuthors(auth.admin, (data ?? []) as ListingRow[]);
    return Response.json({ listings });
  } catch (profilesError) {
    console.error("[looking-for] author enrichment failed:", profilesError);
    const listings = ((data ?? []) as ListingRow[]).map((row) => ({ ...row, author: null }));
    return Response.json({ listings });
  }
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
  if (!CONTACT_METHOD_VALUES.has(contactMethod)) {
    return Response.json(
      { error: "contact_method must be profile, dm, or external." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.admin
    .from("looking_for_listings")
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

  try {
    const [listing] = await withListingAuthors(auth.admin, [data as ListingRow]);
    return Response.json({ listing: listing ?? data });
  } catch (profilesError) {
    console.error("[looking-for] author enrichment failed:", profilesError);
    return Response.json({ listing: { ...(data as ListingRow), author: null } });
  }
}
