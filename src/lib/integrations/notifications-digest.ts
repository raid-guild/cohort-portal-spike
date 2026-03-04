import { supabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_MAX_USERS = 500;
const MAX_ITEMS_PER_DIGEST = 20;

type Cadence = "daily" | "weekly";
type Topic = "blog" | "forum" | "grimoire";

type PreferenceRow = {
  user_id: string;
  email_enabled: boolean;
  cadence: Cadence;
  blog_enabled: boolean;
  forum_enabled: boolean;
  grimoire_enabled: boolean;
  last_digest_sent_at: string | null;
};

type ProfileRow = {
  user_id: string | null;
  email: string | null;
};

type EventRow = {
  id: string;
  kind: string;
  actor_id: string | null;
  subject: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  visibility: "public" | "authenticated" | "private";
  occurred_at: string;
};

type DigestItem = {
  kind: string;
  occurredAt: string;
  title: string;
  href: string;
  summary: string;
};

type UntypedQuery = {
  select: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  not: (...args: unknown[]) => UntypedQuery;
  in: (...args: unknown[]) => UntypedQuery;
  gt: (...args: unknown[]) => UntypedQuery;
  lte: (...args: unknown[]) => UntypedQuery;
  order: (...args: unknown[]) => UntypedQuery;
  limit: (...args: unknown[]) => UntypedQuery;
  insert: (...args: unknown[]) => Promise<{ error: { message: string; code?: string } | null }>;
} & PromiseLike<{ data: unknown; error: { message: string } | null }>;

type UntypedAdmin = {
  from: (table: string) => UntypedQuery;
};

function asUntypedAdmin(admin: ReturnType<typeof supabaseAdminClient>): UntypedAdmin {
  return admin as unknown as UntypedAdmin;
}

function topicKinds(topic: Topic): string[] {
  switch (topic) {
    case "blog":
      return ["core.dao_blog.post_published"];
    case "forum":
      return ["core.member_forum.post_created"];
    case "grimoire":
      return ["core.guild_grimoire.note_created"];
    default:
      return [];
  }
}

function alwaysIncludedKinds(): string[] {
  return ["core.badges.bulk_awarded"];
}

function buildDigestItem(event: EventRow): DigestItem | null {
  const data = event.data ?? {};
  const subject = event.subject ?? {};

  if (event.kind === "core.dao_blog.post_published") {
    const slug = typeof data.slug === "string" ? data.slug : null;
    const title = typeof data.title === "string" ? data.title : "New DAO Blog post";
    return {
      kind: event.kind,
      occurredAt: event.occurred_at,
      title,
      href: slug ? `/modules/dao-blog/${slug}` : "/modules/dao-blog",
      summary: "A new blog post was published.",
    };
  }

  if (event.kind === "core.member_forum.post_created") {
    const postId =
      typeof subject.id === "string"
        ? subject.id
        : typeof data.postId === "string"
          ? data.postId
          : null;
    const title = typeof data.title === "string" ? data.title : "New forum post";
    return {
      kind: event.kind,
      occurredAt: event.occurred_at,
      title,
      href: postId ? `/modules/member-forum/p/${postId}` : "/modules/member-forum",
      summary: "A new post was created in the member forum.",
    };
  }

  if (event.kind === "core.guild_grimoire.note_created") {
    const contentType = typeof data.contentType === "string" ? data.contentType : "note";
    return {
      kind: event.kind,
      occurredAt: event.occurred_at,
      title: "New Guild Grimoire note",
      href: "/modules/guild-grimoire",
      summary: `A new ${contentType} note was shared in Guild Grimoire.`,
    };
  }

  if (event.kind === "core.badges.bulk_awarded") {
    const badgeTitle =
      typeof data.badgeTitle === "string" && data.badgeTitle.trim()
        ? data.badgeTitle.trim()
        : "Community badge";
    return {
      kind: event.kind,
      occurredAt: event.occurred_at,
      title: `Badge earned: ${badgeTitle}`,
      href: "/modules/badges",
      summary: "A new badge was awarded to your profile.",
    };
  }

  return null;
}

function defaultPreferences(userId: string): PreferenceRow {
  return {
    user_id: userId,
    email_enabled: false,
    cadence: "daily",
    blog_enabled: false,
    forum_enabled: false,
    grimoire_enabled: false,
    last_digest_sent_at: null,
  };
}

function cadenceIntervalMs(cadence: Cadence) {
  return cadence === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

function isDue(pref: PreferenceRow, nowMs: number) {
  if (!pref.email_enabled) return false;
  if (!pref.last_digest_sent_at) return true;
  const last = new Date(pref.last_digest_sent_at).valueOf();
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= cadenceIntervalMs(pref.cadence);
}

function activeTopics(pref: PreferenceRow): Topic[] {
  const topics: Topic[] = [];
  if (pref.blog_enabled) topics.push("blog");
  if (pref.forum_enabled) topics.push("forum");
  if (pref.grimoire_enabled) topics.push("grimoire");
  return topics;
}

export async function enqueueNotificationDigests(maxUsers = DEFAULT_MAX_USERS) {
  const admin = asUntypedAdmin(supabaseAdminClient());
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.valueOf();

  const { data: rawProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("user_id,email")
    .not("email", "is", null)
    .limit(maxUsers);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profiles = (rawProfiles ?? []) as ProfileRow[];
  const userIds = profiles.map((row) => row.user_id).filter((id): id is string => Boolean(id));
  if (!userIds.length) {
    return { scanned: 0, eligible: 0, queued: 0 };
  }

  const { data: rawPrefs, error: prefsError } = await admin
    .from("user_notification_preferences")
    .select(
      "user_id,email_enabled,cadence,blog_enabled,forum_enabled,grimoire_enabled,last_digest_sent_at",
    )
    .in("user_id", userIds);

  if (prefsError) {
    throw new Error(prefsError.message);
  }

  const prefsByUserId = new Map<string, PreferenceRow>();
  for (const row of (rawPrefs ?? []) as PreferenceRow[]) {
    prefsByUserId.set(row.user_id, row);
  }

  let eligible = 0;
  let queued = 0;

  for (const profile of profiles) {
    if (!profile.user_id || !profile.email) continue;
    const pref = prefsByUserId.get(profile.user_id) ?? defaultPreferences(profile.user_id);
    if (!isDue(pref, nowMs)) continue;

    const topics = activeTopics(pref);
    const kinds = Array.from(
      new Set([...alwaysIncludedKinds(), ...topics.flatMap((topic) => topicKinds(topic))]),
    );
    if (!kinds.length) continue;
    eligible += 1;

    const startMs = pref.last_digest_sent_at
      ? new Date(pref.last_digest_sent_at).valueOf()
      : nowMs - cadenceIntervalMs(pref.cadence);
    const windowStartIso = new Date(startMs).toISOString();

    const { data: rawEvents, error: eventsError } = await admin
      .from("portal_events")
      .select("id,kind,actor_id,subject,data,visibility,occurred_at")
      .in("kind", kinds)
      .gt("occurred_at", windowStartIso)
      .lte("occurred_at", nowIso)
      .order("occurred_at", { ascending: false })
      .limit(MAX_ITEMS_PER_DIGEST * 2);

    if (eventsError) {
      throw new Error(eventsError.message);
    }

    const filtered = ((rawEvents ?? []) as EventRow[])
      .filter((event) => {
        if (event.kind === "core.badges.bulk_awarded") {
          const userIds = Array.isArray(event.data?.userIds)
            ? event.data?.userIds.filter((value): value is string => typeof value === "string")
            : [];
          return userIds.includes(profile.user_id as string);
        }
        if (event.visibility === "private") {
          return event.actor_id === profile.user_id;
        }
        return true;
      })
      .map(buildDigestItem)
      .filter((item): item is DigestItem => Boolean(item))
      .slice(0, MAX_ITEMS_PER_DIGEST);

    if (!filtered.length) continue;

    const datePart = nowIso.slice(0, 10);
    const digestKey = `digest:${profile.user_id}:${pref.cadence}:${datePart}`;

    const { error: enqueueError } = await admin.from("integration_outbox").insert({
      event_type: "notification.digest.ready",
      payload: {
        digest_key: digestKey,
        user_id: profile.user_id,
        email: profile.email,
        cadence: pref.cadence,
        window_start: windowStartIso,
        window_end: nowIso,
        item_count: filtered.length,
        items: filtered,
      },
    });

    if (enqueueError) {
      if (enqueueError.code === "23505") {
        continue;
      }
      throw new Error(enqueueError.message);
    }

    queued += 1;
  }

  return {
    scanned: profiles.length,
    eligible,
    queued,
  };
}
