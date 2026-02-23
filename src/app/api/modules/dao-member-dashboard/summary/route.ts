import { NextRequest } from "next/server";
import {
  loadDaoMemberOverview,
  requireDaoMember,
} from "@/app/api/modules/dao-member-dashboard/lib";

export async function GET(request: NextRequest) {
  const auth = await requireDaoMember(request);
  if ("error" in auth) {
    const statusValue = auth.status === 401 ? "Sign in" : "Members only";
    return Response.json(
      {
        title: "DAO Member",
        items: [{ label: "Status", value: statusValue }],
      },
      { status: auth.status },
    );
  }

  try {
    const overview = await loadDaoMemberOverview(auth.userId);
    return Response.json({
      title: "DAO Member",
      items: [
        { label: "Active memberships", value: String(overview.totals.activeMemberships) },
        { label: "Voting power", value: overview.totals.votingPower },
        { label: "Shares", value: overview.totals.shares },
        { label: "Loot", value: overview.totals.loot },
      ],
    });
  } catch {
    return Response.json(
      {
        title: "DAO Member",
        items: [{ label: "Status", value: "Unavailable" }],
      },
      { status: 500 },
    );
  }
}
