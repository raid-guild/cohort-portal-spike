import { NextRequest } from "next/server";

import { loadPerson } from "@/lib/people";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const person = await loadPerson(handle);
  if (!person) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ person });
}
