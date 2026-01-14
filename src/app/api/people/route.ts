import { loadPeople } from "@/lib/people";

export async function GET() {
  const people = await loadPeople();
  return Response.json({ people });
}
