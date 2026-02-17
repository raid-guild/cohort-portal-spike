import { NextRequest } from "next/server";
import { requireAuth, asString, jsonError, slugifyTagLabel } from "@/app/api/modules/guild-grimoire/lib";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return jsonError(auth.error, auth.status ?? 401);
  }

  const { data, error } = await auth.admin
    .from("guild_grimoire_tags")
    .select("id,slug,label")
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (error) {
    console.error("[guild-grimoire] tags query error:", error.message);
    return jsonError("Failed to load tags.", 500);
  }

  return Response.json({ tags: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return jsonError(auth.error, auth.status ?? 401);
  }

  const body = (await request.json().catch(() => null)) as { label?: unknown } | null;
  const label = asString(body?.label)?.trim() ?? "";
  if (!label || label.length > 100) {
    return jsonError(
      !label ? "Tag label is required." : "Tag label is too long (max 100 characters).",
      400,
    );
  }

  const slug = slugifyTagLabel(label);
  if (!slug) {
    return jsonError("Tag label must include at least one letter or number.", 400);
  }

  // Try to find existing tag by slug first (safe), then label.
  const bySlug = await auth.admin
    .from("guild_grimoire_tags")
    .select("id,slug,label")
    .eq("slug", slug)
    .maybeSingle();

  if (bySlug.error) {
    console.error("[guild-grimoire] tag lookup error:", bySlug.error.message);
    return jsonError("Failed to create tag.", 500);
  }

  const existing = bySlug.data
    ? bySlug
    : await auth.admin
        .from("guild_grimoire_tags")
        .select("id,slug,label")
        .eq("label", label)
        .maybeSingle();

  if (existing.error) {
    console.error("[guild-grimoire] tag lookup error:", existing.error.message);
    return jsonError("Failed to create tag.", 500);
  }

  if (existing.data) {
    // Ensure it is active.
    const { data: updated, error: updateError } = await auth.admin
      .from("guild_grimoire_tags")
      .update({ is_active: true })
      .eq("id", existing.data.id)
      .select("id,slug,label")
      .maybeSingle();

    if (updateError) {
      console.error("[guild-grimoire] tag reactivate error:", updateError.message);
      return jsonError("Failed to create tag.", 500);
    }

    return Response.json({ tag: updated ?? existing.data });
  }

  const insert = await auth.admin
    .from("guild_grimoire_tags")
    .insert({ slug, label, created_by: auth.userId, is_active: true })
    .select("id,slug,label")
    .single();

  if (insert.error) {
    console.error("[guild-grimoire] tag insert error:", insert.error.message);
    return jsonError("Failed to create tag.", 500);
  }

  return Response.json({ tag: insert.data });
}
