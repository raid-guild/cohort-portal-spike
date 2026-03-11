import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";
import type {
  CalendarAttendeeStatus,
  CalendarEventRecord,
  CalendarEventType,
  CalendarStatus,
  CalendarVisibility,
} from "@/modules/cohort-calendar/shared";

type QueryResult = { data: unknown; error: { message: string } | null };

type UntypedQuery = {
  select: (...args: unknown[]) => UntypedQuery;
  order: (...args: unknown[]) => UntypedQuery;
  eq: (...args: unknown[]) => UntypedQuery;
  in: (...args: unknown[]) => UntypedQuery;
  gte: (...args: unknown[]) => UntypedQuery;
  limit: (...args: unknown[]) => UntypedQuery;
  insert: (...args: unknown[]) => UntypedQuery;
  upsert: (...args: unknown[]) => UntypedQuery;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
} & PromiseLike<QueryResult>;

type UntypedAdmin = {
  from: (table: string) => UntypedQuery;
};

export type CalendarViewer = {
  userId: string | null;
  roles: string[];
  entitlements: string[];
  admin: ReturnType<typeof supabaseAdminClient>;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: CalendarEventType;
  start_time: string;
  end_time: string;
  meeting_url: string | null;
  created_by: string;
  visibility: CalendarVisibility;
  status: CalendarStatus;
  created_at: string;
  updated_at: string;
};

type AttendeeRow = {
  event_id: string;
  user_id: string;
  status: CalendarAttendeeStatus;
};

type ProfileRow = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

const DEFAULT_EVENT_FETCH_LIMIT = 250;
const MAX_EVENT_FETCH_LIMIT = 1000;

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function asUntypedAdmin(
  admin: ReturnType<typeof supabaseAdminClient>,
): UntypedAdmin {
  return admin as unknown as UntypedAdmin;
}

export async function requireCalendarViewer(
  request: NextRequest,
): Promise<CalendarViewer | { error: string; status: number }> {
  const admin = supabaseAdminClient();
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Authentication required.", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) {
    return { error: "Authentication required.", status: 401 };
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

  if (rolesRes.error || entRes.error) {
    console.error("Failed to load cohort calendar viewer access", {
      userId,
      rolesError: rolesRes.error?.message ?? null,
      entitlementsError: entRes.error?.message ?? null,
    });
    return { error: "Failed to load calendar access.", status: 500 };
  }

  const roles =
    ((rolesRes.data ?? []) as Array<{ role: string }>).map((row) => row.role) ?? [];
  const entitlements =
    ((entRes.data ?? []) as Array<{ entitlement: string }>).map(
      (row) => row.entitlement,
    ) ?? [];
  return { userId, roles, entitlements, admin };
}

export function isHost(viewer: CalendarViewer) {
  return viewer.roles.includes("host") || viewer.roles.includes("admin");
}

export function canReadCalendarEvent(
  event: Pick<EventRow, "visibility">,
  viewer: CalendarViewer,
) {
  if (!viewer.userId) return false;
  if (event.visibility === "public") return true;
  if (isHost(viewer)) return true;
  if (event.visibility === "members") {
    return viewer.entitlements.includes("dao-member");
  }
  return viewer.entitlements.includes("cohort-access");
}

function toProfileMap(rows: ProfileRow[]) {
  return new Map(rows.filter((row) => row.user_id).map((row) => [row.user_id, row]));
}

export function toCalendarEventRecord(
  row: EventRow,
  organizer: CalendarEventRecord["organizer"] = null,
  attendees: CalendarEventRecord["attendees"] = [],
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    startTime: row.start_time,
    endTime: row.end_time,
    meetingUrl: row.meeting_url,
    createdBy: row.created_by,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    organizer,
    attendees,
  } satisfies CalendarEventRecord;
}

export async function loadCalendarEvents(
  admin: UntypedAdmin,
  viewer: CalendarViewer,
  opts?: { upcomingOnly?: boolean; limit?: number },
) {
  const requestedLimit = opts?.limit ?? DEFAULT_EVENT_FETCH_LIMIT;
  const fetchLimit = Math.max(requestedLimit, MAX_EVENT_FETCH_LIMIT);
  let query = admin
    .from("calendar_events")
    .select(
      "id,title,description,event_type,start_time,end_time,meeting_url,created_by,visibility,status,created_at,updated_at",
    )
    .order("start_time", { ascending: true })
    .limit(fetchLimit);

  if (opts?.upcomingOnly) {
    query = query.eq("status", "scheduled").gte("end_time", new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const visibleRows = ((data ?? []) as EventRow[])
    .filter((event) => canReadCalendarEvent(event, viewer))
    .slice(0, requestedLimit);

  const creatorIds = Array.from(new Set(visibleRows.map((event) => event.created_by)));
  const attendeeEventIds = visibleRows.map((event) => event.id);

  const [profilesRes, attendeesRes] = await Promise.all([
    creatorIds.length
      ? admin
          .from("profiles")
          .select("user_id,handle,display_name,avatar_url")
          .in("user_id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
    attendeeEventIds.length
      ? admin
          .from("calendar_event_attendees")
          .select("event_id,user_id,status")
          .in("event_id", attendeeEventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesRes.error || attendeesRes.error) {
    throw new Error(
      profilesRes.error?.message ||
        attendeesRes.error?.message ||
        "Failed to load calendar metadata.",
    );
  }

  const attendeeRows = (attendeesRes.data ?? []) as AttendeeRow[];
  const attendeeUserIds = Array.from(new Set(attendeeRows.map((row) => row.user_id)));
  const attendeeProfilesRes = attendeeUserIds.length
    ? await admin
        .from("profiles")
        .select("user_id,handle,display_name,avatar_url")
        .in("user_id", attendeeUserIds)
    : { data: [], error: null };

  if (attendeeProfilesRes.error) {
    throw new Error(attendeeProfilesRes.error.message);
  }

  const organizerProfiles = toProfileMap((profilesRes.data ?? []) as ProfileRow[]);
  const attendeeProfiles = toProfileMap(
    (attendeeProfilesRes.data ?? []) as ProfileRow[],
  );
  const attendeesByEventId = new Map<
    string,
    CalendarEventRecord["attendees"]
  >();

  for (const attendee of attendeeRows) {
    const bucket = attendeesByEventId.get(attendee.event_id) ?? [];
    const profile = attendeeProfiles.get(attendee.user_id);
    bucket.push({
      userId: attendee.user_id,
      status: attendee.status,
      handle: profile?.handle ?? "",
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    });
    attendeesByEventId.set(attendee.event_id, bucket);
  }

  return visibleRows.map((row) => {
    const organizer = organizerProfiles.get(row.created_by);
    return toCalendarEventRecord(
      row,
      organizer
        ? {
            userId: organizer.user_id,
            handle: organizer.handle,
            displayName: organizer.display_name,
            avatarUrl: organizer.avatar_url,
          }
        : null,
      (attendeesByEventId.get(row.id) ?? []).sort((a, b) =>
        (a.displayName || a.handle || a.userId).localeCompare(
          b.displayName || b.handle || b.userId,
        ),
      ),
    );
  });
}
