import { NextRequest } from "next/server";
import type { TablesInsert } from "@/lib/types/db";
import { requireFeedbackAuth } from "../_auth";
import {
  parseItemQuery,
  type FeedbackCreateInput,
  type FeedbackItem,
  validateCreateInput,
} from "../lib";

const ITEM_SELECT =
  "id,type,title,description_md,steps_to_reproduce_md,expected_result_md,actual_result_md,problem_md,proposed_outcome_md,status,priority,module_id,route_path,reporter_user_id,assignee_user_id,triage_notes,browser_meta,created_at,updated_at,closed_at";

export async function GET(request: NextRequest) {
  const auth = await requireFeedbackAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const query = parseItemQuery(new URL(request.url));
  const mineOnly = auth.isHost ? query.mine : true;

  let dbQuery = auth.admin
    .from("feedback_items")
    .select(ITEM_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(query.limit + 1);

  if (mineOnly) {
    dbQuery = dbQuery.eq("reporter_user_id", auth.userId);
  }
  if (query.type) {
    dbQuery = dbQuery.eq("type", query.type);
  }
  if (query.status) {
    dbQuery = dbQuery.eq("status", query.status);
  }
  if (query.priority) {
    dbQuery = dbQuery.eq("priority", query.priority);
  }
  if (query.q) {
    dbQuery = dbQuery.or(
      `title.ilike.%${query.q}%,description_md.ilike.%${query.q}%,problem_md.ilike.%${query.q}%,proposed_outcome_md.ilike.%${query.q}%`,
    );
  }
  if (query.cursor) {
    dbQuery = dbQuery.lt("created_at", query.cursor);
  }

  const { data, error } = await dbQuery;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as FeedbackItem[];
  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.created_at ?? null : null;

  return Response.json({
    items,
    nextCursor,
    mine: mineOnly,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireFeedbackAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: FeedbackCreateInput;
  try {
    body = (await request.json()) as FeedbackCreateInput;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const validated = validateCreateInput(body, auth.userId);
  if (!validated.value) {
    return Response.json({ error: validated.error ?? "Invalid payload." }, { status: 400 });
  }

  const insert: TablesInsert<"feedback_items"> = validated.value;

  const { data, error } = await auth.admin
    .from("feedback_items")
    .insert(insert)
    .select(ITEM_SELECT)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    item: data,
    trackingId: data.id,
  });
}
