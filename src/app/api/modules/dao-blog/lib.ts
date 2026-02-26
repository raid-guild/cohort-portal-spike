import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export const POST_STATUSES = ["draft", "in_review", "published"] as const;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_HEADER_IMAGE_HOSTS = new Set(["images.unsplash.com"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type DaoBlogPost = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  header_image_url: string;
  body_md: string;
  status: "draft" | "in_review" | "published";
  published_at: string | null;
  author_user_id: string;
  review_submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

type UntypedQuery = {
  select: (...args: unknown[]) => UntypedQuery;
  order: (...args: unknown[]) => UntypedQuery;
  or: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  in: (...args: unknown[]) => UntypedQuery;
  ilike: (...args: unknown[]) => UntypedQuery;
  lt: (...args: unknown[]) => UntypedQuery;
  gte: (...args: unknown[]) => UntypedQuery;
  limit: (...args: unknown[]) => UntypedQuery;
  is: (...args: unknown[]) => UntypedQuery;
  insert: (...args: unknown[]) => UntypedQuery;
  update: (...args: unknown[]) => UntypedQuery;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
} & PromiseLike<QueryResult>;

type UntypedAdmin = {
  from: (table: string) => UntypedQuery;
};

export type DaoBlogViewer = {
  userId: string;
  roles: string[];
  entitlements: string[];
  admin: ReturnType<typeof supabaseAdminClient>;
};

export function asUntypedAdmin(admin: ReturnType<typeof supabaseAdminClient>): UntypedAdmin {
  return admin as unknown as UntypedAdmin;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseLimit(raw: string | null, fallback = 20, max = 50) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function toKebabCase(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isHostRole(roles: string[]) {
  return roles.includes("host") || roles.includes("admin");
}

export function hasActiveDaoMember(entitlements: string[]) {
  return entitlements.includes("dao-member");
}

export function canAuthor(viewer: DaoBlogViewer) {
  return isHostRole(viewer.roles) || hasActiveDaoMember(viewer.entitlements);
}

export function validatePostPayload(input: {
  title: string | null;
  slug: string | null;
  summary: string | null;
  headerImageUrl: string | null;
  bodyMd: string | null;
  headerImageMimeType: string | null;
  headerImageSizeBytes: number | null;
}) {
  if (!input.title) return "title is required.";
  if (!input.slug) return "slug is required.";
  if (!input.summary) return "summary is required.";
  if (!input.headerImageUrl) return "header_image_url is required.";
  if (!input.bodyMd) return "body_md is required.";

  if (input.summary.length > 280) {
    return "summary must be 280 characters or fewer.";
  }

  const normalizedSlug = toKebabCase(input.slug);
  if (!normalizedSlug || normalizedSlug !== input.slug) {
    return "slug must be lowercase kebab-case.";
  }

  if (input.headerImageMimeType && !ALLOWED_IMAGE_MIME_TYPES.has(input.headerImageMimeType)) {
    return "header image mime type must be image/jpeg, image/png, or image/webp.";
  }

  try {
    const parsedHeaderImageUrl = new URL(input.headerImageUrl);
    if (
      parsedHeaderImageUrl.protocol !== "https:" ||
      !ALLOWED_HEADER_IMAGE_HOSTS.has(parsedHeaderImageUrl.hostname)
    ) {
      return "header_image_url host is not allowed.";
    }
  } catch {
    return "header_image_url must be a valid URL.";
  }

  if (
    typeof input.headerImageSizeBytes === "number" &&
    Number.isFinite(input.headerImageSizeBytes) &&
    input.headerImageSizeBytes > MAX_IMAGE_BYTES
  ) {
    return "header image must be 5MB or smaller.";
  }

  return null;
}

export async function requireViewer(
  request: NextRequest,
): Promise<{ error: string; status: number } | DaoBlogViewer> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token.", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "Invalid auth token.", status: 401 };
  }

  const admin = supabaseAdminClient();
  const userId = userData.user.id;
  const now = new Date().toISOString();

  const [rolesRes, entRes] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId),
    admin
      .from("entitlements")
      .select("entitlement")
      .eq("user_id", userId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  if (rolesRes.error) {
    return { error: `Failed to load roles: ${rolesRes.error.message}`, status: 500 };
  }
  if (entRes.error) {
    return { error: `Failed to load entitlements: ${entRes.error.message}`, status: 500 };
  }

  const roles = rolesRes.data?.map((row) => row.role) ?? [];
  const entitlements = entRes.data?.map((row) => row.entitlement) ?? [];

  return { userId, roles, entitlements, admin };
}

export async function loadPostById(admin: ReturnType<typeof supabaseAdminClient>, id: string) {
  const untyped = asUntypedAdmin(admin);
  const { data, error } = await untyped
    .from("dao_blog_posts")
    .select(
      "id,title,slug,summary,header_image_url,body_md,status,published_at,author_user_id,review_submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at,deleted_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as DaoBlogPost | null) ?? null;
}
