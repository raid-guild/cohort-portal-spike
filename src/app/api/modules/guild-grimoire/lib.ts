import { NextRequest } from "next/server";
import { requireAuth } from "@/app/api/looking-for/_auth";

export { requireAuth };

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "string") as string[];
  }
  return [];
}

export function getQuery(request: NextRequest) {
  const url = new URL(request.url);
  return url.searchParams;
}

export function slugifyTagLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
