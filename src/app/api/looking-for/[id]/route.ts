import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "../_auth";

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

async function loadListing(admin: ReturnType<typeof supabaseAdminClient>, id: string) {
  return admin
    .from("looking_for_listings")
    .select(
      "id, type, title, description, category, tags, status, created_by, contact_method, external_contact, created_at, updated_at, fulfilled_at",
    )
    .eq("id", id)
    .single();
}

async function withListingAuthor(
  admin: ReturnType<typeof supabaseAdminClient>,
  listing: ListingRow,
) {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("user_id,handle,display_name,avatar_url")
    .eq("user_id", listing.created_by)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load listing author for ${listing.created_by}: ${profileError.message}`);
  }

  return {
    ...listing,
    author: (profile as ListingAuthor | null) ?? null,
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const { id } = await context.params;
  const { data, error } = await loadListing(auth.admin, id);
  if (error) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  try {
    return Response.json({ listing: await withListingAuthor(auth.admin, data as ListingRow) });
  } catch (profileError) {
    return Response.json(
      { error: profileError instanceof Error ? profileError.message : "Failed to load listing author." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const { id } = await context.params;
  const existing = await loadListing(auth.admin, id);
  if (existing.error || !existing.data) {
    return Response.json({ error: existing.error?.message ?? "Listing not found." }, { status: 404 });
  }

  const isHost = auth.roles.includes("host");
  const existingListing = existing.data;
  const isOwner = String(existingListing.created_by) === auth.userId;
  if (!isHost && !isOwner) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.type != null) {
    const type = String(body.type).trim();
    if (!TYPE_VALUES.has(type)) {
      return Response.json({ error: "type must be looking_for or offering." }, { status: 400 });
    }
    patch.type = type;
  }

  if (body.title != null) {
    const title = String(body.title).trim();
    if (!title) return Response.json({ error: "Title cannot be empty." }, { status: 400 });
    patch.title = title;
  }

  if (body.description != null) {
    patch.description = String(body.description ?? "");
  }

  if (body.category !== undefined) {
    patch.category = body.category ? String(body.category).trim() : null;
  }

  if (body.tags !== undefined) {
    if (body.tags == null) {
      patch.tags = null;
    } else if (Array.isArray(body.tags)) {
      patch.tags = (body.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean);
    } else {
      return Response.json({ error: "tags must be an array." }, { status: 400 });
    }
  }

  if (body.contact_method != null || body.contactMethod != null) {
    const contactMethod = String(body.contact_method ?? body.contactMethod).trim();
    if (!CONTACT_METHOD_VALUES.has(contactMethod)) {
      return Response.json(
        { error: "contact_method must be profile, dm, or external." },
        { status: 400 },
      );
    }
    patch.contact_method = contactMethod;
  }

  if (body.external_contact !== undefined || body.externalContact !== undefined) {
    const value = body.external_contact ?? body.externalContact;
    patch.external_contact = value ? String(value).trim() : null;
  }

  if (body.status != null) {
    if (!isHost) {
      return Response.json({ error: "Only hosts can change status directly." }, { status: 403 });
    }
    const status = String(body.status).trim();
    if (!STATUS_VALUES.has(status)) {
      return Response.json({ error: "Invalid status." }, { status: 400 });
    }
    patch.status = status;
    if (status === "fulfilled") {
      patch.fulfilled_at = new Date().toISOString();
    } else {
      patch.fulfilled_at = null;
    }
  }

  if (!Object.keys(patch).length) {
    return Response.json({ error: "No changes provided." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("looking_for_listings")
    .update(patch)
    .eq("id", id)
    .select(
      "id, type, title, description, category, tags, status, created_by, contact_method, external_contact, created_at, updated_at, fulfilled_at",
    )
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ listing: await withListingAuthor(auth.admin, data as ListingRow) });
}
