import { NextRequest } from "next/server";
import { canWriteSpace, getViewer, getVisibleSpaces, jsonError } from "@/app/api/modules/member-forum/lib";

export async function GET(request: NextRequest) {
  try {
    const viewer = await getViewer(request);
    const spaces = await getVisibleSpaces(viewer);

    return Response.json({
      spaces: spaces.map((space) => ({
        ...space,
        can_write: canWriteSpace(space, viewer),
      })),
    });
  } catch (err) {
    console.error("[member-forum] spaces error:", err);
    return jsonError("Failed to load spaces.", 500);
  }
}
