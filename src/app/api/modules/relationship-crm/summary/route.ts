import { NextRequest } from "next/server";
import { jsonError, requireCrmAccess } from "@/app/api/modules/relationship-crm/lib";

export async function GET(request: NextRequest) {
  const viewer = await requireCrmAccess(request);
  if ("error" in viewer) {
    return jsonError(viewer.error, viewer.status);
  }

  const admin = viewer.admin;
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const [activeAccountsRes, overdueTasksRes, dueTodayRes] = await Promise.all([
    admin
      .from("relationship_crm_accounts")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "active"),
    admin
      .from("relationship_crm_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .lt("due_at", now.toISOString()),
    admin
      .from("relationship_crm_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .gte("due_at", startOfDay.toISOString())
      .lt("due_at", endOfDay.toISOString()),
  ]);

  const error = activeAccountsRes.error ?? overdueTasksRes.error ?? dueTodayRes.error;
  if (error) {
    return jsonError(`Failed to load summary: ${error.message}`, 500);
  }

  return Response.json({
    title: "Relationship CRM",
    items: [
      { label: "Active accounts", value: String(activeAccountsRes.count ?? 0) },
      { label: "Overdue tasks", value: String(overdueTasksRes.count ?? 0) },
      { label: "Due today", value: String(dueTodayRes.count ?? 0) },
    ],
  });
}
