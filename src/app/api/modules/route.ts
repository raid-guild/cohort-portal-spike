import { loadRegistry } from "@/lib/registry";

export function GET() {
  const registry = loadRegistry();
  return Response.json(registry);
}
