import { NextRequest } from "next/server";
import { requireAuth, getQuery, jsonError } from "@/app/api/modules/guild-grimoire/lib";

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return jsonError(auth.error, auth.status ?? 401);
  }

  const q = getQuery(request);
  const tag = q.get("tag"); // tag_id
  const contentType = q.get("contentType");
  const visibility = q.get("visibility");
  const mine = q.get("mine") === "true";
  const limit = Math.max(1, Math.min(Number(q.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 100));

  if (visibility === "private" && !mine) {
    return jsonError("Private notes can only be queried with mine=true.", 400);
  }

  const select = tag
    ? "id,user_id,content_type,text_content,image_url,audio_url,audio_duration_sec,audio_transcript,audio_transcription_status,visibility,created_at,deleted_at,guild_grimoire_note_tags!inner(tag_id,guild_grimoire_tags(id,slug,label))"
    : "id,user_id,content_type,text_content,image_url,audio_url,audio_duration_sec,audio_transcript,audio_transcription_status,visibility,created_at,deleted_at,guild_grimoire_note_tags(tag_id,guild_grimoire_tags(id,slug,label))";

  let query = auth.admin
    .from("guild_grimoire_notes")
    .select(select)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (mine) {
    query = query.eq("user_id", auth.userId);
  } else {
    query = query.in("visibility", ["shared", "public", "cohort"]);
  }

  if (contentType) {
    if (!["text", "image", "audio"].includes(contentType)) {
      return jsonError("Invalid contentType.", 400);
    }
    query = query.eq("content_type", contentType);
  }

  if (visibility && visibility !== "all") {
    if (!["private", "shared", "cohort", "public"].includes(visibility)) {
      return jsonError("Invalid visibility.", 400);
    }
    query = query.eq("visibility", visibility);
  }

  // Tag filter via join table.
  if (tag) {
    query = query.eq("guild_grimoire_note_tags.tag_id", tag);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[guild-grimoire] feed query error:", error.message);
    return jsonError("Failed to load feed.", 500);
  }

  type TagRow = { id: string; slug: string; label: string };
  type LinkRow = { tag_id: string; guild_grimoire_tags: TagRow | null };
  type AuthorRow = {
    user_id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  type NoteRow = {
    id: string;
    user_id: string;
    content_type: string;
    text_content: string | null;
    image_url: string | null;
    audio_url: string | null;
    audio_duration_sec: number | null;
    audio_transcript: string | null;
    audio_transcription_status: string | null;
    visibility: string;
    created_at: string;
    deleted_at: string | null;
    guild_grimoire_note_tags: LinkRow[] | null;
  };

  const rows = (data ?? []) as NoteRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));

  const authorByUserId = new Map<string, AuthorRow>();
  if (userIds.length) {
    const profilesRes = await auth.admin
      .from("profiles")
      .select("user_id,handle,display_name,avatar_url")
      .in("user_id", userIds);

    if (profilesRes.error) {
      console.error("[guild-grimoire] profiles query error:", profilesRes.error.message);
      return jsonError("Failed to load feed.", 500);
    }

    for (const author of (profilesRes.data ?? []) as AuthorRow[]) {
      if (author.user_id) {
        authorByUserId.set(author.user_id, author);
      }
    }
  }

  const notes = rows.map((row) => {
    const links = row.guild_grimoire_note_tags ?? [];
    const tags = links
      .map((l) => l.guild_grimoire_tags)
      .filter((t): t is TagRow => Boolean(t))
      .map((t) => ({ id: t.id, slug: t.slug, label: t.label }));

    return {
      id: row.id,
      user_id: row.user_id,
      content_type: row.content_type,
      text_content: row.text_content,
      image_url: row.image_url,
      audio_url: row.audio_url,
      audio_duration_sec: row.audio_duration_sec,
      audio_transcript: row.audio_transcript,
      audio_transcription_status: row.audio_transcription_status,
      visibility: row.visibility,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
      author: authorByUserId.get(row.user_id) ?? null,
      tags,
    };
  });

  return Response.json({ notes });
}
