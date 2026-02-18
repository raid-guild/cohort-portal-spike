import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { upsertMarketingContact } from "@/lib/sendgrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 8;
const MAX_BACKOFF_SECONDS = 60 * 60;
const PROCESSING_GRACE_MS = 10 * 60 * 1000;

type OutboxRow = {
  id: number;
  event_type: string;
  payload: Record<string, unknown> | null;
  attempt_count: number;
};

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function toDate(secondsFromNow: number) {
  return new Date(Date.now() + secondsFromNow * 1000).toISOString();
}

function computeBackoffSeconds(attemptCount: number) {
  const exp = Math.min(attemptCount, 10);
  return Math.min(2 ** exp * 15, MAX_BACKOFF_SECONDS);
}

async function handleEmailReferralCreated(payload: Record<string, unknown> | null) {
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  if (!email) {
    throw new Error("Missing payload.email for email_referral.created");
  }
  await upsertMarketingContact(email);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const nowIso = new Date().toISOString();
  const staleProcessingThresholdIso = new Date(
    Date.now() - PROCESSING_GRACE_MS,
  ).toISOString();

  const { error: recoverError } = await admin
    .from("integration_outbox")
    .update({
      status: "pending",
      updated_at: nowIso,
    })
    .eq("status", "processing")
    .lt("updated_at", staleProcessingThresholdIso);

  if (recoverError) {
    return Response.json({ error: recoverError.message }, { status: 500 });
  }

  const { data: pendingRows, error: pendingError } = await admin
    .from("integration_outbox")
    .select("id")
    .eq("status", "pending")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (pendingError) {
    return Response.json({ error: pendingError.message }, { status: 500 });
  }

  const ids = (pendingRows ?? []).map((row: { id: number }) => row.id);
  if (!ids.length) {
    return Response.json({ ok: true, processed: 0, sent: 0, failed: 0 });
  }

  const { data: claimedRows, error: claimError } = await admin
    .from("integration_outbox")
    .update({
      status: "processing",
      updated_at: nowIso,
    })
    .in("id", ids)
    .eq("status", "pending")
    .select("id,event_type,payload,attempt_count");

  if (claimError) {
    return Response.json({ error: claimError.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const row of (claimedRows ?? []) as OutboxRow[]) {
    try {
      switch (row.event_type) {
        case "email_referral.created":
          await handleEmailReferralCreated(row.payload);
          break;
        default:
          const { error: unsupportedError } = await admin
            .from("integration_outbox")
            .update({
              status: "failed",
              last_error: `Unsupported event_type: ${row.event_type}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          if (unsupportedError) {
            throw new Error(unsupportedError.message);
          }

          failed += 1;
          continue;
      }

      const { error } = await admin
        .from("integration_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (error) throw new Error(error.message);
      sent += 1;
    } catch (error) {
      const nextAttemptCount = (row.attempt_count ?? 0) + 1;
      const retryable = nextAttemptCount < MAX_ATTEMPTS;
      const backoffSeconds = computeBackoffSeconds(nextAttemptCount);
      const message = error instanceof Error ? error.message : "Unknown error";

      const { error: updateError } = await admin
        .from("integration_outbox")
        .update({
          status: retryable ? "pending" : "failed",
          attempt_count: nextAttemptCount,
          next_attempt_at: retryable ? toDate(backoffSeconds) : new Date().toISOString(),
          last_error: message.slice(0, 4000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        console.error("Failed to update outbox row:", row.id, updateError.message);
      }
      failed += 1;
    }
  }

  return Response.json({
    ok: true,
    processed: (claimedRows ?? []).length,
    sent,
    failed,
  });
}
