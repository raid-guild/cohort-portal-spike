import { loadPerson } from "@/lib/people";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle");
  if (!handle) {
    return Response.json({ error: "Missing handle" }, { status: 400 });
  }

  const profile = await loadPerson(handle);
  if (!profile) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    title: "Profile Skills",
    items: [
      {
        label: "Skills",
        value: String((profile.skills ?? []).length),
      },
      {
        label: "Roles",
        value: String((profile.roles ?? []).length),
      },
      {
        label: "Location",
        value: profile.location ?? "TBD",
      },
    ],
  });
}
