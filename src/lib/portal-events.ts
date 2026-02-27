import crypto from "node:crypto";
import { loadRegistry } from "@/lib/registry";
import { supabaseAdminClient } from "@/lib/supabase/admin";

export const PORTAL_EVENT_VISIBILITIES = [
  "public",
  "authenticated",
  "private",
] as const;

export type PortalEventVisibility = (typeof PORTAL_EVENT_VISIBILITIES)[number];

export type PortalEventInput = {
  moduleId: string;
  kind: string;
  authenticatedUserId?: string | null;
  actorId?: string | null;
  subject?: Record<string, unknown> | null;
  data?: unknown;
  visibility?: PortalEventVisibility;
  occurredAt?: string | null;
  source?: string | null;
  dedupeKey?: string | null;
};

type JsonRecord = Record<string, unknown>;

type EmitCapability = {
  kinds?: string[];
  requiresUserAuth?: boolean;
};

type EmitAuthorization = {
  moduleId: string;
  kind: string;
  viewerId?: string | null;
};

type UntypedQuery = {
  insert: (...args: unknown[]) => UntypedQuery;
  select: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
} & PromiseLike<{ data: unknown; error: { message: string } | null }>;

type UntypedAdmin = {
  from: (table: string) => UntypedQuery;
};

function asUntypedAdmin(admin: ReturnType<typeof supabaseAdminClient>): UntypedAdmin {
  return admin as unknown as UntypedAdmin;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asVisibility(value: unknown): PortalEventVisibility | null {
  if (typeof value !== "string") return null;
  if (!PORTAL_EVENT_VISIBILITIES.includes(value as PortalEventVisibility)) {
    return null;
  }
  return value as PortalEventVisibility;
}

function asOccurredAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.valueOf())) return null;
  return parsed.toISOString();
}

function resolveEmitCapability(moduleId: string): EmitCapability | null {
  const registry = loadRegistry();
  const module = registry.modules.find((entry) => entry.id === moduleId);
  if (!module) return null;
  return module.capabilities?.events?.emit ?? null;
}

function validateKindForModule(kind: string, moduleId: string) {
  if (kind.startsWith("custom.")) {
    return kind.startsWith(`custom.${moduleId}.`);
  }
  return kind.startsWith("core.");
}

export function ensureEmitAuthorized({ moduleId, kind, viewerId }: EmitAuthorization) {
  const emit = resolveEmitCapability(moduleId);
  if (!emit) {
    throw new Error("Module does not declare capabilities.events.emit.");
  }

  const allowedKinds = emit.kinds ?? [];
  if (!allowedKinds.includes(kind)) {
    throw new Error("Event kind is not allowed for this module.");
  }

  if (!validateKindForModule(kind, moduleId)) {
    throw new Error("Event kind does not match naming rules for this module.");
  }

  if (emit.requiresUserAuth && !viewerId) {
    throw new Error("Authenticated user required to emit this event.");
  }
}

function normalizeEventInput(input: PortalEventInput) {
  const moduleId = input.moduleId.trim();
  const kind = input.kind.trim();
  if (!moduleId) {
    throw new Error("moduleId is required.");
  }
  if (!kind) {
    throw new Error("kind is required.");
  }

  const visibility = input.visibility ?? "authenticated";
  if (!asVisibility(visibility)) {
    throw new Error("Invalid visibility.");
  }

  if (input.subject !== undefined && input.subject !== null && !isRecord(input.subject)) {
    throw new Error("subject must be an object.");
  }

  let occurredAt = input.occurredAt ?? null;
  if (occurredAt) {
    occurredAt = asOccurredAt(occurredAt);
    if (!occurredAt) {
      throw new Error("occurredAt must be a valid ISO datetime.");
    }
  }

  return {
    moduleId,
    kind,
    authenticatedUserId: input.authenticatedUserId ?? null,
    actorId: input.actorId ?? null,
    subject: input.subject ?? null,
    data: input.data ?? null,
    visibility,
    occurredAt,
    source: input.source?.trim() || null,
    dedupeKey: input.dedupeKey?.trim() || null,
  };
}

export async function emitPortalEvent(input: PortalEventInput) {
  const normalized = normalizeEventInput(input);
  const admin = supabaseAdminClient();
  const untyped = asUntypedAdmin(admin);

  ensureEmitAuthorized({
    moduleId: normalized.moduleId,
    kind: normalized.kind,
    viewerId: normalized.authenticatedUserId,
  });

  const { error } = await untyped.from("portal_events").insert({
    module_id: normalized.moduleId,
    kind: normalized.kind,
    actor_id: normalized.actorId,
    subject: normalized.subject,
    data: normalized.data,
    visibility: normalized.visibility,
    occurred_at: normalized.occurredAt ?? new Date().toISOString(),
    source: normalized.source ?? `module:${normalized.moduleId}`,
    dedupe_key: normalized.dedupeKey,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true };
}

export async function verifyModuleKey(moduleId: string, moduleKey: string) {
  const admin = supabaseAdminClient();
  const untyped = asUntypedAdmin(admin);
  const hash = crypto.createHash("sha256").update(moduleKey).digest("hex");

  const { data, error } = await untyped
    .from("module_keys")
    .select("key_hash")
    .eq("module_id", moduleId)
    .maybeSingle();

  if (error || !isRecord(data) || typeof data.key_hash !== "string") return false;
  if (!/^[a-f0-9]{64}$/i.test(data.key_hash)) return false;

  const storedHash = Buffer.from(data.key_hash, "hex");
  const providedHash = Buffer.from(hash, "hex");
  if (storedHash.length !== providedHash.length) return false;

  return crypto.timingSafeEqual(storedHash, providedHash);
}
