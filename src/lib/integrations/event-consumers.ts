import { supabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;

const FIRST_GRIMOIRE_NOTE_CONSUMER_ID = "badges:first-grimoire-note";
const FIRST_GRIMOIRE_BADGE_ID = "grimoire-first-note";
const FIRST_GRIMOIRE_EVENT_KIND = "core.guild_grimoire.note_created";

const BADGES_TIMELINE_CONSUMER_ID = "timeline:badges-bulk-awarded";
const BADGES_BULK_AWARDED_EVENT_KIND = "core.badges.bulk_awarded";

type EventRow = {
  id: string;
  kind: string;
  actor_id: string | null;
  occurred_at: string;
  data: Record<string, unknown> | null;
};

type ConsumptionRow = {
  event_id: string;
};

type UntypedQuery = {
  select: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  in: (...args: unknown[]) => UntypedQuery;
  order: (...args: unknown[]) => UntypedQuery;
  limit: (...args: unknown[]) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  upsert: (...args: unknown[]) => Promise<{ error: { message: string } | null }>;
  insert: (...args: unknown[]) => Promise<{ error: { message: string } | null }>;
} & PromiseLike<{ data: unknown; error: { message: string } | null }>;

type UntypedAdmin = {
  from: (table: string) => UntypedQuery;
};

function asUntypedAdmin(admin: ReturnType<typeof supabaseAdminClient>): UntypedAdmin {
  return admin as unknown as UntypedAdmin;
}

function normalizeBatchSize(batchSize?: number) {
  if (!Number.isFinite(batchSize) || !batchSize || batchSize <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(Math.trunc(batchSize), MAX_BATCH_SIZE);
}

async function markConsumed(
  admin: UntypedAdmin,
  consumerId: string,
  eventId: string,
  status: "processed" | "failed",
  error?: string | null,
  metadata?: Record<string, unknown>,
) {
  const { error: insertError } = await admin.from("portal_event_consumptions").upsert(
    {
      consumer_id: consumerId,
      event_id: eventId,
      status,
      error: error ?? null,
      metadata: metadata ?? null,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "consumer_id,event_id" },
  );

  if (insertError) {
    console.error(
      "[event-consumer] failed to persist consumption state:",
      consumerId,
      eventId,
      insertError.message,
    );
  }
}

async function loadUnconsumedEvents(
  admin: UntypedAdmin,
  kind: string,
  consumerId: string,
  limit: number,
) {
  const { data: rawEvents, error: eventsError } = await admin
    .from("portal_events")
    .select("id,kind,actor_id,occurred_at,data")
    .eq("kind", kind)
    .order("occurred_at", { ascending: true })
    .limit(limit * 2);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const events = ((rawEvents ?? []) as EventRow[]).slice(0, limit * 2);
  if (!events.length) return [];

  const eventIds = events.map((event) => event.id);
  const { data: rawConsumptions, error: consumptionsError } = await admin
    .from("portal_event_consumptions")
    .select("event_id")
    .eq("consumer_id", consumerId)
    .in("event_id", eventIds);

  if (consumptionsError) {
    throw new Error(consumptionsError.message);
  }

  const consumedIds = new Set(
    ((rawConsumptions ?? []) as ConsumptionRow[]).map((row) => row.event_id),
  );
  return events.filter((event) => !consumedIds.has(event.id)).slice(0, limit);
}

async function processFirstGrimoireConsumer(admin: UntypedAdmin, limit: number) {
  const queue = await loadUnconsumedEvents(
    admin,
    FIRST_GRIMOIRE_EVENT_KIND,
    FIRST_GRIMOIRE_NOTE_CONSUMER_ID,
    limit,
  );
  let consumed = 0;
  let awarded = 0;
  let failed = 0;

  for (const event of queue) {
    try {
      const userId = event.actor_id;
      if (!userId) {
        await markConsumed(
          admin,
          FIRST_GRIMOIRE_NOTE_CONSUMER_ID,
          event.id,
          "failed",
          "Missing actor_id.",
        );
        failed += 1;
        continue;
      }

      const { data: existingAward, error: existingAwardError } = await admin
        .from("user_badges")
        .select("user_id")
        .eq("user_id", userId)
        .eq("badge_id", FIRST_GRIMOIRE_BADGE_ID)
        .maybeSingle();

      if (existingAwardError) {
        throw new Error(existingAwardError.message);
      }

      const { error: upsertError } = await admin.from("user_badges").upsert(
        {
          user_id: userId,
          badge_id: FIRST_GRIMOIRE_BADGE_ID,
          note: "Automatically awarded for first Guild Grimoire note.",
          metadata: {
            source_consumer: FIRST_GRIMOIRE_NOTE_CONSUMER_ID,
            source_event_id: event.id,
            source_event_kind: event.kind,
            source_event_occurred_at: event.occurred_at,
          },
        },
        { onConflict: "user_id,badge_id" },
      );

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      const awardedNow = !existingAward;
      if (awardedNow) awarded += 1;

      await markConsumed(
        admin,
        FIRST_GRIMOIRE_NOTE_CONSUMER_ID,
        event.id,
        "processed",
        null,
        {
          awarded: awardedNow,
          badge_id: FIRST_GRIMOIRE_BADGE_ID,
        },
      );
      consumed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await markConsumed(
        admin,
        FIRST_GRIMOIRE_NOTE_CONSUMER_ID,
        event.id,
        "failed",
        message.slice(0, 4000),
      );
      failed += 1;
    }
  }

  return {
    processed: queue.length,
    consumed,
    awarded,
    failed,
  };
}

function readUserIdsFromBadgeEvent(data: Record<string, unknown> | null): string[] {
  const raw = data?.userIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string" && Boolean(value));
}

function trimTitle(value: string, max = 120) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

async function processBadgesTimelineConsumer(admin: UntypedAdmin, limit: number) {
  const queue = await loadUnconsumedEvents(
    admin,
    BADGES_BULK_AWARDED_EVENT_KIND,
    BADGES_TIMELINE_CONSUMER_ID,
    limit,
  );

  let consumed = 0;
  let timelineEntries = 0;
  let failed = 0;

  for (const event of queue) {
    try {
      const userIds = readUserIdsFromBadgeEvent(event.data);
      if (!userIds.length) {
        await markConsumed(
          admin,
          BADGES_TIMELINE_CONSUMER_ID,
          event.id,
          "failed",
          "Missing data.userIds.",
        );
        failed += 1;
        continue;
      }

      const badgeTitle =
        typeof event.data?.badgeTitle === "string" ? event.data.badgeTitle : "Community badge";
      const badgeId = typeof event.data?.badgeId === "string" ? event.data.badgeId : null;
      const note = typeof event.data?.note === "string" ? event.data.note : null;
      const title = trimTitle(`Badge earned: ${badgeTitle}`);

      const rows = userIds.map((userId) => ({
        user_id: userId,
        kind: "milestone",
        title,
        body: note || null,
        visibility: "authenticated",
        occurred_at: event.occurred_at,
        created_by: event.actor_id,
        created_via_role: "host",
        source_kind: BADGES_BULK_AWARDED_EVENT_KIND,
        source_ref: {
          event_id: event.id,
          badge_id: badgeId,
        },
      }));

      const { error: insertError } = await admin
        .from("timeline_entries")
        .upsert(rows, { onConflict: "user_id,source_kind,source_ref", ignoreDuplicates: true });
      if (insertError) {
        throw new Error(insertError.message);
      }

      // Approximate count: ignoreDuplicates may skip existing rows.
      timelineEntries += rows.length;
      consumed += 1;
      await markConsumed(
        admin,
        BADGES_TIMELINE_CONSUMER_ID,
        event.id,
        "processed",
        null,
        {
          timeline_entries: rows.length,
          badge_id: badgeId,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await markConsumed(
        admin,
        BADGES_TIMELINE_CONSUMER_ID,
        event.id,
        "failed",
        message.slice(0, 4000),
      );
      failed += 1;
    }
  }

  return {
    processed: queue.length,
    consumed,
    timelineEntries,
    failed,
  };
}

export async function processEventConsumersBatch(batchSize?: number) {
  const limit = normalizeBatchSize(batchSize);
  const untyped = asUntypedAdmin(supabaseAdminClient());

  const [grimoire, badgesTimeline] = await Promise.all([
    processFirstGrimoireConsumer(untyped, limit),
    processBadgesTimelineConsumer(untyped, limit),
  ]);

  return {
    processed: grimoire.processed + badgesTimeline.processed,
    consumed: grimoire.consumed + badgesTimeline.consumed,
    awarded: grimoire.awarded,
    timelineEntries: badgesTimeline.timelineEntries,
    failed: grimoire.failed + badgesTimeline.failed,
  };
}
