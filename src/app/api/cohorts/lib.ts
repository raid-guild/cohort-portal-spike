import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

const PARTICIPANT_STATUSES = new Set(["active", "alumni", "inactive"]);

export type CohortParticipantInput = {
  handle: string;
  role?: string | null;
  status?: string | null;
  sortOrder?: number | null;
};

export type CohortPartnerInput = {
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  crmAccountId?: string | null;
  displayOrder?: number | null;
};

export const requireUser = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing auth token." } as const;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid auth token." } as const;
  }
  return { user: data.user } as const;
};

export const isHost = async (userId: string) => {
  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["host", "admin"])
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to verify host access: ${error.message}`);
  }
  return Boolean(data);
};

export const hasCohortAccess = async (userId: string) => {
  const admin = supabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("entitlements")
    .select("entitlement")
    .eq("user_id", userId)
    .eq("entitlement", "cohort-access")
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to verify cohort access: ${error.message}`);
  }
  return Boolean(data);
};

export const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asNullableString = (value: unknown) => {
  const parsed = asString(value);
  return parsed.length ? parsed : null;
};

const asHttpUrl = (value: unknown) => {
  const parsed = asNullableString(value);
  if (!parsed) return null;
  let url: URL;
  try {
    url = new URL(parsed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  return url.toString();
};

const asStatus = (value: unknown) => {
  const parsed = asString(value).toLowerCase();
  if (PARTICIPANT_STATUSES.has(parsed)) {
    return parsed;
  }
  return "active";
};

const asNumber = (value: unknown, fallback: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
};

const asUuid = (value: unknown) => {
  const parsed = asString(value);
  if (!parsed) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    return null;
  }
  return parsed;
};

export function parseParticipants(value: unknown): CohortParticipantInput[] {
  if (!Array.isArray(value)) return [];
  const rows: CohortParticipantInput[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const handle = asString(record.handle).toLowerCase();
    if (!handle) continue;
    rows.push({
      handle,
      role: asNullableString(record.role),
      status: asStatus(record.status),
      sortOrder: asNumber(record.sortOrder, index),
    });
  }
  return rows;
}

export function parsePartners(value: unknown): CohortPartnerInput[] {
  if (!Array.isArray(value)) return [];
  const rows: CohortPartnerInput[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = asString(record.name);
    if (!name) continue;
    rows.push({
      name,
      logoUrl: asNullableString(record.logoUrl),
      description: asNullableString(record.description),
      websiteUrl: asHttpUrl(record.websiteUrl),
      crmAccountId: asUuid(record.crmAccountId),
      displayOrder: asNumber(record.displayOrder, index),
    });
  }
  return rows;
}

type SyncCohortRelationshipsInput = {
  cohortId: string;
  participants?: CohortParticipantInput[];
  partners?: CohortPartnerInput[];
  syncParticipants?: boolean;
  syncPartners?: boolean;
};

async function resolveParticipantRows(participants: CohortParticipantInput[]) {
  const admin = supabaseAdminClient();
  const uniqueHandles = [...new Set(participants.map((participant) => participant.handle))];
  const { data: profileRows, error: profileError } = uniqueHandles.length
    ? await admin
        .from("profiles")
        .select("user_id, handle")
        .in("handle", uniqueHandles)
        .not("user_id", "is", null)
    : { data: [], error: null };

  if (profileError) {
    throw new Error(`Failed to resolve participants: ${profileError.message}`);
  }

  const profileByHandle = new Map(
    (profileRows ?? [])
      .map((row) => ({ userId: row.user_id, handle: row.handle?.toLowerCase() ?? "" }))
      .filter((row): row is { userId: string; handle: string } => Boolean(row.userId && row.handle))
      .map((row) => [row.handle, row.userId]),
  );

  const missingHandles = uniqueHandles.filter((handle) => !profileByHandle.has(handle));
  if (missingHandles.length) {
    throw new Error(`Unknown participant handle(s): ${missingHandles.join(", ")}`);
  }

  const rows: {
    user_id: string;
    role: string | null;
    status: string;
    sort_order: number;
  }[] = [];
  for (let index = 0; index < participants.length; index += 1) {
    const participant = participants[index];
    const userId = profileByHandle.get(participant.handle);
    if (!userId) {
      throw new Error(`Unknown participant handle: ${participant.handle}`);
    }
    rows.push({
      user_id: userId,
      role: participant.role ?? null,
      status: participant.status ?? "active",
      sort_order: participant.sortOrder ?? index,
    });
  }

  return rows;
}

export async function syncCohortRelationships(input: SyncCohortRelationshipsInput) {
  const admin = supabaseAdminClient();
  if (input.syncParticipants) {
    const participantRows = await resolveParticipantRows(input.participants ?? []);
    const { error: deleteError } = await admin
      .from("cohort_participants")
      .delete()
      .eq("cohort_id", input.cohortId);
    if (deleteError) {
      throw new Error(`Failed to clear participants: ${deleteError.message}`);
    }

    if (participantRows.length) {
      const { error: insertError } = await admin.from("cohort_participants").insert(
        participantRows.map((participant) => ({
          cohort_id: input.cohortId,
          user_id: participant.user_id,
          role: participant.role,
          status: participant.status,
          sort_order: participant.sort_order,
        })),
      );
      if (insertError) {
        throw new Error(`Failed to save participants: ${insertError.message}`);
      }
    }
  }

  if (input.syncPartners) {
    const partnerRows = (input.partners ?? []).map((partner, index) => ({
      cohort_id: input.cohortId,
      name: partner.name,
      logo_url: partner.logoUrl ?? null,
      description: partner.description ?? "",
      website_url: partner.websiteUrl ?? null,
      crm_account_id: partner.crmAccountId ?? null,
      display_order: partner.displayOrder ?? index,
    }));

    const { error: deleteError } = await admin
      .from("cohort_partners")
      .delete()
      .eq("cohort_id", input.cohortId);
    if (deleteError) {
      throw new Error(`Failed to clear partners: ${deleteError.message}`);
    }

    if (partnerRows.length) {
      const { error: insertError } = await admin.from("cohort_partners").insert(partnerRows);
      if (insertError) {
        throw new Error(`Failed to save partners: ${insertError.message}`);
      }
    }
  }
}

export async function loadCohortParticipants(cohortId: string) {
  const admin = supabaseAdminClient();
  const { data: participants, error: participantError } = await admin
    .from("cohort_participants")
    .select("user_id, role, status, sort_order")
    .eq("cohort_id", cohortId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (participantError) {
    throw new Error(`Failed to load participants: ${participantError.message}`);
  }

  const userIds = [...new Set((participants ?? []).map((row) => row.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await admin
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url")
        .in("user_id", userIds)
    : { data: [], error: null };

  if (profileError) {
    throw new Error(`Failed to load participant profiles: ${profileError.message}`);
  }

  const profileByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  return (participants ?? [])
    .map((participant) => {
      const profile = profileByUserId.get(participant.user_id);
      if (!profile?.handle) return null;
      return {
        userId: participant.user_id,
        handle: profile.handle,
        displayName: profile.display_name ?? profile.handle,
        avatarUrl: profile.avatar_url,
        role: participant.role,
        status: participant.status,
        sortOrder: participant.sort_order,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function loadCohortPartners(cohortId: string) {
  const admin = supabaseAdminClient();
  const { data: partners, error } = await admin
    .from("cohort_partners")
    .select("id, name, logo_url, description, website_url, crm_account_id, display_order")
    .eq("cohort_id", cohortId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load partners: ${error.message}`);
  }

  return (partners ?? []).map((partner) => ({
    id: partner.id,
    name: partner.name,
    logoUrl: partner.logo_url,
    description: partner.description,
    websiteUrl: partner.website_url,
    crmAccountId: partner.crm_account_id,
    displayOrder: partner.display_order,
  }));
}
