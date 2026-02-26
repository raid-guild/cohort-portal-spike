import { NextRequest } from "next/server";
import { canAuthor, requireViewer } from "@/app/api/modules/dao-blog/lib";

export async function GET(request: NextRequest) {
  const viewer = await requireViewer(request);
  if ("error" in viewer) {
    return Response.json({ can_author: false });
  }

  return Response.json({ can_author: canAuthor(viewer) });
}
