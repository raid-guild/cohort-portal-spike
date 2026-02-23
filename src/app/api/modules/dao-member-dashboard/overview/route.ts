import { NextRequest } from "next/server";
import {
  loadDaoMemberOverview,
  requireDaoMember,
} from "@/app/api/modules/dao-member-dashboard/lib";

export async function GET(request: NextRequest) {
  const auth = await requireDaoMember(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const overview = await loadDaoMemberOverview(auth.userId);
    return Response.json(overview);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load member dashboard." },
      { status: 500 },
    );
  }
}
