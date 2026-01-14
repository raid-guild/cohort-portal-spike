import type { Tables } from "@/lib/types/db";

export type AnnouncementRow = Tables<"announcements">;

type FilterOptions = {
  roles: string[];
  viewerId?: string | null;
  now?: Date;
};

function isWithinSchedule(row: AnnouncementRow, now: Date) {
  if (row.starts_at) {
    const starts = new Date(row.starts_at);
    if (Number.isFinite(starts.valueOf()) && starts > now) {
      return false;
    }
  }
  if (row.ends_at) {
    const ends = new Date(row.ends_at);
    if (Number.isFinite(ends.valueOf()) && ends < now) {
      return false;
    }
  }
  return true;
}

function matchesAudience(row: AnnouncementRow, roles: string[], isAuthed: boolean) {
  if (row.audience === "public") {
    return true;
  }
  if (row.audience === "authenticated") {
    return isAuthed;
  }
  if (row.audience === "host") {
    return roles.includes("host");
  }
  return false;
}

function matchesRoleTargets(row: AnnouncementRow, roles: string[]) {
  if (!row.role_targets?.length) {
    return true;
  }
  return row.role_targets.some((role) => roles.includes(role));
}

export function filterAnnouncements(
  rows: AnnouncementRow[],
  { roles, viewerId, now = new Date() }: FilterOptions,
) {
  const authed = Boolean(viewerId);
  return rows.filter((row) => {
    if (!isWithinSchedule(row, now)) {
      return false;
    }
    if (!matchesAudience(row, roles, authed)) {
      return false;
    }
    return matchesRoleTargets(row, roles);
  });
}
