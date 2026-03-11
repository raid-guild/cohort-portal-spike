export const CALENDAR_EVENT_TYPES = [
  "brown_bag",
  "cohort_session",
  "community_call",
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_VISIBILITIES = ["public", "members", "cohort"] as const;
export type CalendarVisibility = (typeof CALENDAR_VISIBILITIES)[number];

type CalendarAudienceAccess = {
  roles: string[];
  entitlements: string[];
};

export const CALENDAR_STATUSES = ["scheduled", "cancelled"] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const CALENDAR_ATTENDEE_STATUSES = [
  "attending",
  "declined",
  "pending",
] as const;
export type CalendarAttendeeStatus =
  (typeof CALENDAR_ATTENDEE_STATUSES)[number];

export type CalendarEventRecord = {
  id: string;
  title: string;
  description: string | null;
  eventType: CalendarEventType;
  startTime: string;
  endTime: string;
  meetingUrl: string | null;
  createdBy: string;
  visibility: CalendarVisibility;
  status: CalendarStatus;
  createdAt?: string;
  updatedAt?: string;
  organizer: {
    userId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    isHost: boolean;
  } | null;
  attendees: Array<{
    userId: string;
    status: CalendarAttendeeStatus;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
};

export const CALENDAR_EVENT_TYPE_META: Record<
  CalendarEventType,
  {
    label: string;
    badgeClassName: string;
    defaultDurationMinutes: number;
    defaultTitle: string;
    defaultDescription: string;
    defaultVisibility: CalendarVisibility;
  }
> = {
  brown_bag: {
    label: "Brown Bag",
    badgeClassName:
      "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-200",
    defaultDurationMinutes: 20,
    defaultTitle: "Brown Bag",
    defaultDescription: "Community member presentation or demo",
    defaultVisibility: "members",
  },
  cohort_session: {
    label: "Cohort Session",
    badgeClassName:
      "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
    defaultDurationMinutes: 90,
    defaultTitle: "Cohort Session",
    defaultDescription: "Official cohort session",
    defaultVisibility: "cohort",
  },
  community_call: {
    label: "Community Call",
    badgeClassName:
      "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
    defaultDurationMinutes: 60,
    defaultTitle: "Community Call",
    defaultDescription: "Open community sync for announcements and discussion",
    defaultVisibility: "public",
  },
};

export function getCalendarEventTemplate(eventType: CalendarEventType) {
  const meta = CALENDAR_EVENT_TYPE_META[eventType];
  return {
    title: meta.defaultTitle,
    description: meta.defaultDescription,
    durationMinutes: meta.defaultDurationMinutes,
    visibility: meta.defaultVisibility,
  };
}

export function hasCalendarHostAccess(access: CalendarAudienceAccess) {
  return access.roles.includes("host") || access.roles.includes("admin");
}

export function canAccessCalendarVisibility(
  visibility: CalendarVisibility,
  access: CalendarAudienceAccess,
) {
  if (visibility === "public") return true;
  if (hasCalendarHostAccess(access)) return true;
  if (visibility === "members") {
    return access.entitlements.includes("dao-member");
  }
  return access.entitlements.includes("cohort-access");
}

export function getReadableCalendarVisibilities(access: CalendarAudienceAccess) {
  return CALENDAR_VISIBILITIES.filter((visibility) =>
    canAccessCalendarVisibility(visibility, access),
  );
}

export function coerceCalendarVisibility(
  visibility: CalendarVisibility,
  access: CalendarAudienceAccess,
) {
  return canAccessCalendarVisibility(visibility, access) ? visibility : "public";
}

function toCalendarTimestamp(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildGoogleCalendarUrl(event: {
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  meetingUrl: string | null;
}) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarTimestamp(event.startTime)}/${toCalendarTimestamp(event.endTime)}`,
  });

  if (event.description) {
    params.set("details", event.description);
  }

  if (event.meetingUrl) {
    params.set("location", event.meetingUrl);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildCalendarEventIcs(event: {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  meetingUrl: string | null;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RaidGuild//Cohort Portal//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@raidguild.org`,
    `DTSTAMP:${toCalendarTimestamp(new Date())}`,
    `DTSTART:${toCalendarTimestamp(event.startTime)}`,
    `DTEND:${toCalendarTimestamp(event.endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.meetingUrl) {
    lines.push(`LOCATION:${escapeIcsText(event.meetingUrl)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
