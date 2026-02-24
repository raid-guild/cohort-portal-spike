import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

type AccessLevel = "public" | "member" | "cohort";
type WriteLevel = "member" | "cohort";

export type ForumSpace = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  read_level: AccessLevel;
  write_level: WriteLevel;
  cohort_id: string | null;
};

export type ForumPost = {
  id: string;
  space_id: string;
  author_id: string;
  title: string;
  body_md: string;
  is_locked: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type ForumComment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body_md: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type ViewerContext = {
  userId: string | null;
  roles: string[];
  entitlements: string[];
  admin: ReturnType<typeof supabaseAdminClient>;
};

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

type UntypedQuery = {
  select: (...args: unknown[]) => UntypedQuery;
  order: (...args: unknown[]) => UntypedQuery;
  or: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  in: (...args: unknown[]) => UntypedQuery;
  gt: (...args: unknown[]) => UntypedQuery;
  lt: (...args: unknown[]) => UntypedQuery;
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

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function asUntypedAdmin(admin: ReturnType<typeof supabaseAdminClient>): UntypedAdmin {
  return admin as unknown as UntypedAdmin;
}

export async function getViewer(request: NextRequest): Promise<ViewerContext> {
  const admin = supabaseAdminClient();
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, roles: [], entitlements: [], admin };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) {
    return { userId: null, roles: [], entitlements: [], admin };
  }

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

  const roles = rolesRes.data?.map((row) => row.role) ?? [];
  const entitlements = entRes.data?.map((row) => row.entitlement) ?? [];

  return { userId, roles, entitlements, admin };
}

export function isHost(viewer: ViewerContext) {
  return viewer.roles.includes("host") || viewer.roles.includes("admin");
}

export function canReadSpace(space: ForumSpace, viewer: ViewerContext) {
  if (space.read_level === "public") return true;
  if (!viewer.userId) return false;
  if (isHost(viewer)) return true;
  if (space.read_level === "member") {
    return viewer.entitlements.includes("dao-member");
  }
  return viewer.entitlements.includes("cohort-access");
}

export function canWriteSpace(space: ForumSpace, viewer: ViewerContext) {
  if (!viewer.userId) return false;
  if (isHost(viewer)) return true;
  if (space.write_level === "member") {
    return viewer.entitlements.includes("dao-member");
  }
  return viewer.entitlements.includes("cohort-access");
}

export async function getVisibleSpaces(
  viewer: ViewerContext,
  onlySlug?: string,
): Promise<ForumSpace[]> {
  const admin = asUntypedAdmin(viewer.admin);
  const query = admin
    .from("forum_spaces")
    .select("id,slug,name,description,read_level,write_level,cohort_id")
    .order("name", { ascending: true });

  if (onlySlug) {
    query.eq("slug", onlySlug);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ForumSpace[]).filter((space) => canReadSpace(space, viewer));
}

export function sanitizePostForResponse(post: ForumPost) {
  return {
    id: post.id,
    space_id: post.space_id,
    author_id: post.author_id,
    title: post.title,
    body_md: post.body_md,
    is_locked: post.is_locked,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
}

export function sanitizeCommentForResponse(comment: ForumComment) {
  return {
    id: comment.id,
    post_id: comment.post_id,
    author_id: comment.author_id,
    parent_comment_id: comment.parent_comment_id,
    body_md: comment.body_md,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
  };
}
