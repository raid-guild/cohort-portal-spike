import { supabaseAdminClient } from "@/lib/supabase/admin";

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
};

export type UserBadge = {
  badgeId: string;
  awardedAt: string;
  definition: BadgeDefinition;
};

export type UserBadgePreview = {
  id: string;
  title: string;
  image_url: string | null;
  sort_order: number;
};

export async function loadBadgesForUser(userId: string): Promise<UserBadge[]> {
  const admin = supabaseAdminClient();

  const { data: badgeRows, error: badgesError } = await admin
    .from("user_badges")
    .select("badge_id, awarded_at")
    .eq("user_id", userId);

  if (badgesError) {
    throw new Error(badgesError.message);
  }

  const badgeIds = (badgeRows ?? []).map((row) => row.badge_id).filter(Boolean);
  if (!badgeIds.length) {
    return [];
  }

  const { data: definitions, error: defsError } = await admin
    .from("badge_definitions")
    .select("id, title, description, image_url, sort_order")
    .in("id", badgeIds)
    .eq("is_active", true);

  if (defsError) {
    throw new Error(defsError.message);
  }

  const byId = new Map(
    (definitions ?? []).map((def) => [
      def.id,
      {
        id: def.id,
        title: def.title,
        description: def.description ?? null,
        image_url: def.image_url ?? null,
        sort_order: def.sort_order ?? 0,
      } satisfies BadgeDefinition,
    ]),
  );

  return (badgeRows ?? [])
    .map((row) => {
      const def = byId.get(row.badge_id);
      if (!def) return null;
      return {
        badgeId: row.badge_id,
        awardedAt: row.awarded_at,
        definition: def,
      } satisfies UserBadge;
    })
    .filter((row): row is UserBadge => Boolean(row))
    .sort((a, b) => {
      if (a.definition.sort_order !== b.definition.sort_order) {
        return a.definition.sort_order - b.definition.sort_order;
      }
      return a.definition.title.localeCompare(b.definition.title);
    });
}

export async function loadActiveBadgeDefinitions(): Promise<BadgeDefinition[]> {
  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("badge_definitions")
    .select("id, title, description, image_url, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description ?? null,
    image_url: def.image_url ?? null,
    sort_order: def.sort_order ?? 0,
  }));
}

export async function loadBadgePreviewsForUsers(
  userIds: string[],
): Promise<Record<string, UserBadgePreview[]>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};

  const admin = supabaseAdminClient();
  const { data: rows, error } = await admin
    .from("user_badges")
    .select("user_id, badge_id")
    .in("user_id", ids);

  if (error) {
    throw new Error(error.message);
  }

  const badgeIds = [...new Set((rows ?? []).map((row) => row.badge_id).filter(Boolean))];
  if (!badgeIds.length) return {};

  const { data: defs, error: defsError } = await admin
    .from("badge_definitions")
    .select("id, title, image_url, sort_order")
    .in("id", badgeIds)
    .eq("is_active", true);

  if (defsError) {
    throw new Error(defsError.message);
  }

  const byId = new Map(
    (defs ?? []).map((def) => [
      def.id,
      {
        id: def.id,
        title: def.title,
        image_url: def.image_url ?? null,
        sort_order: def.sort_order ?? 0,
      } satisfies UserBadgePreview,
    ]),
  );

  const result: Record<string, UserBadgePreview[]> = {};
  for (const row of rows ?? []) {
    const def = byId.get(row.badge_id);
    if (!def) continue;
    if (!result[row.user_id]) result[row.user_id] = [];
    result[row.user_id].push(def);
  }

  for (const userId of Object.keys(result)) {
    result[userId] = result[userId].sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.title.localeCompare(b.title);
    });
  }

  return result;
}
