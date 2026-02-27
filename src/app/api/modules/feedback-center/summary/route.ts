import { NextRequest } from "next/server";
import { requireFeedbackAuth } from "../_auth";

export async function GET(request: NextRequest) {
  const auth = await requireFeedbackAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const mineOnly = !auth.isHost;
  let query = auth.admin
    .from("feedback_items")
    .select("status");

  if (mineOnly) {
    query = query.eq("reporter_user_id", auth.userId);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const newCount = rows.filter((row) => row.status === "new").length;
  const triagedCount = rows.filter((row) => row.status === "triaged").length;
  const inProgressCount = rows.filter((row) => row.status === "in_progress").length;

  return Response.json({
    title: mineOnly ? "My feedback" : "Feedback center",
    items: [
      { label: "New", value: String(newCount) },
      { label: "Triaged", value: String(triagedCount) },
      { label: "In progress", value: String(inProgressCount) },
    ],
  });
}
