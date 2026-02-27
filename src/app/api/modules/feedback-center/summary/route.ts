import { NextRequest } from "next/server";
import { requireFeedbackAuth } from "../_auth";

export async function GET(request: NextRequest) {
  const auth = await requireFeedbackAuth(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const mineOnly = !auth.isHost;

  const countByStatus = async (status: "new" | "triaged" | "in_progress") => {
    let query = auth.admin
      .from("feedback_items")
      .select("id", { count: "exact", head: true })
      .eq("status", status);

    if (mineOnly) {
      query = query.eq("reporter_user_id", auth.userId);
    }

    const { count, error } = await query;
    if (error) {
      throw error;
    }
    return count ?? 0;
  };

  let newCount = 0;
  let triagedCount = 0;
  let inProgressCount = 0;
  try {
    [newCount, triagedCount, inProgressCount] = await Promise.all([
      countByStatus("new"),
      countByStatus("triaged"),
      countByStatus("in_progress"),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load summary.";
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({
    title: mineOnly ? "My feedback" : "Feedback center",
    items: [
      { label: "New", value: String(newCount) },
      { label: "Triaged", value: String(triagedCount) },
      { label: "In progress", value: String(inProgressCount) },
    ],
  });
}
