import { NextRequest } from "next/server";
import { requireAuth } from "../../_auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const message = String(body?.body ?? "").trim();
  if (!message) {
    return Response.json({ error: "Comment body is required." }, { status: 400 });
  }

  const { data: comment, error } = await auth.admin
    .from("bounty_comments")
    .insert({ bounty_id: id, user_id: auth.userId, body: message })
    .select("id, bounty_id, user_id, body, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ comment });
}
