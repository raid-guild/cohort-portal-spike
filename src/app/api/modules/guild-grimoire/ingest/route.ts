import { NextRequest } from "next/server";
import { asString, asStringArray, jsonError } from "@/app/api/modules/guild-grimoire/lib";
import { supabaseAdminClient } from "@/lib/supabase/admin";

const API_KEY = process.env.GUILD_GRIMOIRE_INGEST_API_KEY ?? "";
const INGEST_USER_ID = process.env.GUILD_GRIMOIRE_INGEST_USER_ID ?? "";
const MAX_TEXT = 256;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS_PER_IP = 30;
const RATE_MAX_REQUESTS_PER_KEY = 120;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ipRateBuckets = new Map<string, number[]>();
const keyRateBuckets = new Map<string, number[]>();

function sanitizeVisibility(raw: string | null) {
  if (!raw) return "shared";
  if (["private", "shared", "cohort", "public"].includes(raw)) return raw;
  return null;
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function rateLimitCheck(bucketKey: string, maxRequests: number, map: Map<string, number[]>) {
  const now = Date.now();
  const bucket = map.get(bucketKey) ?? [];
  const recent = bucket.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= maxRequests) {
    map.set(bucketKey, recent);
    return false;
  }
  recent.push(now);
  map.set(bucketKey, recent);
  return true;
}

export async function POST(request: NextRequest) {
  if (!API_KEY || !INGEST_USER_ID) {
    return jsonError("Missing server configuration.", 500);
  }

  if (!UUID_RE.test(INGEST_USER_ID)) {
    return jsonError("Invalid server configuration.", 500);
  }

  const headerKey = request.headers.get("x-grimoire-api-key");
  if (!headerKey || headerKey !== API_KEY) {
    return jsonError("Unauthorized.", 401);
  }

  const ip = getClientIp(request);
  if (!rateLimitCheck(ip, RATE_MAX_REQUESTS_PER_IP, ipRateBuckets)) {
    return jsonError("Too many requests.", 429);
  }

  if (!rateLimitCheck(headerKey, RATE_MAX_REQUESTS_PER_KEY, keyRateBuckets)) {
    return jsonError("Too many requests.", 429);
  }

  const body = (await request.json().catch(() => null)) as
    | {
        text_content?: unknown;
        visibility?: unknown;
        tag_ids?: unknown;
      }
    | null;

  const textContent = asString(body?.text_content);
  const visibility = sanitizeVisibility(asString(body?.visibility));
  const tagIds = asStringArray(body?.tag_ids);

  if (!visibility) {
    return jsonError("Invalid visibility.", 400);
  }

  const trimmed = (textContent ?? "").trim();
  if (!trimmed) {
    return jsonError("text_content is required for text notes.", 400);
  }
  if (trimmed.length > MAX_TEXT) {
    return jsonError(`text_content must be <= ${MAX_TEXT} characters.`, 400);
  }

  const admin = supabaseAdminClient();
  const insert = await admin
    .from("guild_grimoire_notes")
    .insert({
      user_id: INGEST_USER_ID,
      content_type: "text",
      text_content: trimmed,
      visibility,
    })
    .select("id")
    .single();

  if (insert.error) {
    console.error("[guild-grimoire] ingest insert error:", insert.error.message);
    return jsonError("Failed to create note.", 500);
  }

  const noteId = insert.data.id as string;

  if (tagIds.length) {
    const rows = tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId }));
    const linkRes = await admin.from("guild_grimoire_note_tags").insert(rows);
    if (linkRes.error) {
      console.error("[guild-grimoire] ingest link tags error:", linkRes.error.message);
    }
  }

  return Response.json({ id: noteId });
}
