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
