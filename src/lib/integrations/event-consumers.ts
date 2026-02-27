import { supabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const FIRST_GRIMOIRE_NOTE_CONSUMER_ID = "badges:first-grimoire-note";
const FIRST_GRIMOIRE_BADGE_ID = "grimoire-first-note";
const FIRST_GRIMOIRE_EVENT_KIND = "core.guild_grimoire.note_created";

type EventRow = {
  id: string;
  kind: string;
  actor_id: string | null;
  occurred_at: string;
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
  eventId: string,
  status: "processed" | "failed",
  error?: string | null,
  metadata?: Record<string, unknown>,
) {
  const { error: insertError } = await admin.from("portal_event_consumptions").upsert(
    {
      consumer_id: FIRST_GRIMOIRE_NOTE_CONSUMER_ID,
      event_id: eventId,
      status,
      error: error ?? null,
      metadata: metadata ?? null,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "consumer_id,event_id" },
  );

  if (insertError) {
    console.error("[event-consumer] failed to persist consumption state:", eventId, insertError.message);
  }
}

export async function processEventConsumersBatch(batchSize?: number) {
  const limit = normalizeBatchSize(batchSize);
  const untyped = asUntypedAdmin(supabaseAdminClient());

  const { data: rawEvents, error: eventsError } = await untyped
    .from("portal_events")
    .select("id,kind,actor_id,occurred_at")
    .eq("kind", FIRST_GRIMOIRE_EVENT_KIND)
    .order("occurred_at", { ascending: true })
    .limit(limit * 2);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const events = ((rawEvents ?? []) as EventRow[]).slice(0, limit * 2);
  if (!events.length) {
    return { processed: 0, consumed: 0, awarded: 0, failed: 0 };
  }

  const eventIds = events.map((event) => event.id);
  const { data: rawConsumptions, error: consumptionsError } = await untyped
    .from("portal_event_consumptions")
    .select("event_id")
    .eq("consumer_id", FIRST_GRIMOIRE_NOTE_CONSUMER_ID)
    .in("event_id", eventIds);

  if (consumptionsError) {
    throw new Error(consumptionsError.message);
  }

  const consumedIds = new Set(
    ((rawConsumptions ?? []) as ConsumptionRow[]).map((row) => row.event_id),
  );
  const queue = events.filter((event) => !consumedIds.has(event.id)).slice(0, limit);

  let consumed = 0;
  let awarded = 0;
  let failed = 0;

  for (const event of queue) {
    try {
      const userId = event.actor_id;
      if (!userId) {
        await markConsumed(untyped, event.id, "failed", "Missing actor_id.");
        failed += 1;
        continue;
      }

      const { data: existingAward, error: existingAwardError } = await untyped
        .from("user_badges")
        .select("user_id")
        .eq("user_id", userId)
        .eq("badge_id", FIRST_GRIMOIRE_BADGE_ID)
        .maybeSingle();

      if (existingAwardError) {
        throw new Error(existingAwardError.message);
      }

      const { error: upsertError } = await untyped.from("user_badges").upsert(
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

      await markConsumed(untyped, event.id, "processed", null, {
        awarded: awardedNow,
        badge_id: FIRST_GRIMOIRE_BADGE_ID,
      });
      consumed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await markConsumed(untyped, event.id, "failed", message.slice(0, 4000));
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
