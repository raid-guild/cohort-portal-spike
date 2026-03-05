import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { CohortLandingHostLink } from "@/modules/cohort-hub/CohortLandingHostLink";
import { CohortDashboardNav } from "@/modules/cohort-hub/components/CohortDashboardNav";
import { CohortHeroCta } from "@/modules/cohort-hub/components/CohortHeroCta";
import { PartnersGrid } from "@/modules/cohort-hub/components/PartnersGrid";
import { ParticipantsGrid } from "@/modules/cohort-hub/components/ParticipantsGrid";
import { ProjectsCarousel } from "@/modules/cohort-hub/components/ProjectsCarousel";
import { QuestBoard } from "@/modules/cohort-hub/components/QuestBoard";
import { ResourceBrowser } from "@/modules/cohort-hub/components/ResourceBrowser";
import { ScheduleSection } from "@/modules/cohort-hub/components/ScheduleSection";
import { type StatItem, StatsCards } from "@/modules/cohort-hub/components/StatsCards";
import type {
  PartnerCard,
  ParticipantCard,
  ProjectCard,
  QuestItem,
  ResourceCard,
  ScheduleEvent,
} from "@/modules/cohort-hub/landing-types";

type CohortRow = {
  id: string;
  slug: string | null;
  name: string;
  status: string;
  start_at: string | null;
  end_at: string | null;
  theme_long: string | null;
  header_image_url: string | null;
};

type CohortContentRow = {
  schedule: unknown;
  projects: unknown;
  resources: unknown;
  notes: unknown;
};

type CohortParticipantRow = {
  user_id: string;
  role: string | null;
  status: string;
};

type CohortPartnerRow = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string;
  website_url: string | null;
  crm_account_id: string | null;
};

type ProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  links: unknown;
};

type LandingRecord = {
  cohort: CohortRow;
  content: CohortContentRow | null;
  participants: ParticipantCard[];
  partners: PartnerCard[];
};

function getSiteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatRange(startAt: string | null, endAt: string | null) {
  if (!startAt && !endAt) return "Dates TBD";
  const start = startAt ? new Date(startAt).toLocaleDateString("en-US") : "TBD";
  const end = endAt ? new Date(endAt).toLocaleDateString("en-US") : "TBD";
  return `${start} -> ${end}`;
}

function toArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toStringValue(item)).filter(Boolean);
}

function normalizeType(value: string) {
  const lower = value.toLowerCase().trim();
  if (!lower) return "general";
  if (lower.includes("youtube") || lower.includes("video")) return "youtube";
  if (lower.includes("repo") || lower.includes("github")) return "repo";
  if (lower.includes("doc") || lower.includes("hackmd")) return "document";
  if (lower.includes("tool")) return "tool";
  if (lower.includes("article")) return "article";
  return lower;
}

function deriveCategory(raw: Record<string, unknown>, normalizedType: string) {
  const explicit = toStringValue(raw.category);
  if (explicit) return explicit;
  if (normalizedType === "youtube") return "Videos";
  if (normalizedType === "repo") return "Repositories";
  if (normalizedType === "document") return "Docs";
  if (normalizedType === "tool") return "Tools";
  return "General";
}

function normalizeSchedule(raw: unknown): ScheduleEvent[] {
  return toArray(raw)
    .map((item, index) => {
      const date = toStringValue(item.date) || null;
      const agenda = toStringValue(item.agenda);
      const title = toStringValue(item.title) || agenda || `Day ${index + 1}`;
      const description = toStringValue(item.description) || toStringValue(item.notes);
      const day = Number(item.day);
      const numericDay = Number.isFinite(day) ? day : index + 1;
      return {
        id: `${title}-${date ?? "unknown"}-${index}`,
        day: numericDay,
        title,
        description,
        date,
        type: toStringValue(item.type) || "session",
      };
    })
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.day - b.day;
    });
}

function normalizeProjects(raw: unknown): ProjectCard[] {
  return toArray(raw).map((item, index) => {
    const title = toStringValue(item.title) || toStringValue(item.name) || `Project ${index + 1}`;
    return {
      id: `${title}-${index}`,
      title,
      description: toStringValue(item.description),
      links: toStringArray(item.links),
      notes: toStringValue(item.notes),
    };
  });
}

function normalizeResources(raw: unknown): ResourceCard[] {
  return toArray(raw).map((item, index) => {
    const type = normalizeType(toStringValue(item.type));
    const link = toStringValue(item.link) || toStringValue(item.url);
    return {
      id: `${toStringValue(item.title) || "resource"}-${index}`,
      title: toStringValue(item.title) || `Resource ${index + 1}`,
      description: toStringValue(item.description),
      link,
      type,
      category: deriveCategory(item, type),
    };
  });
}

function normalizeQuests(rawNotes: unknown): QuestItem[] {
  const notes = toArray(rawNotes);
  const fromNotes = notes
    .map((note, index) => {
      const title = toStringValue(note.title);
      const body = toStringValue(note.body);
      const value = title || body;
      if (!value) return null;
      if (!/quest|onboarding|checklist|todo/i.test(value)) return null;
      return {
        id: `quest-note-${index}`,
        label: body || title,
        completed: false,
      };
    })
    .filter((item): item is QuestItem => Boolean(item));

  return fromNotes;
}

function parseLinks(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, raw]) => {
    const parsed = toStringValue(raw);
    if (parsed) {
      acc[key] = parsed;
    }
    return acc;
  }, {});
}

function computeDuration(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) return "TBD";
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "TBD";
  const diff = Math.max(0, end.getTime() - start.getTime());
  const weeks = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 7)));
  return `${weeks} weeks`;
}

async function loadCohort(id: string): Promise<LandingRecord | null> {
  const admin = supabaseAdminClient();

  const { data: bySlug, error: bySlugError } = await admin
    .from("cohorts")
    .select("id,slug,name,status,start_at,end_at,theme_long,header_image_url")
    .eq("slug", id)
    .maybeSingle();

  if (bySlugError) {
    throw new Error(bySlugError.message);
  }

  let cohortData = bySlug;
  if (!cohortData && isUuid(id)) {
    const { data: byId, error: byIdError } = await admin
      .from("cohorts")
      .select("id,slug,name,status,start_at,end_at,theme_long,header_image_url")
      .eq("id", id)
      .maybeSingle();

    if (byIdError) {
      throw new Error(byIdError.message);
    }
    cohortData = byId;
  }

  if (!cohortData) return null;

  const cohortId = (cohortData as { id: string }).id;
  const [contentResult, participantResult, partnerResult] = await Promise.all([
    admin
      .from("cohort_content")
      .select("schedule,projects,resources,notes")
      .eq("cohort_id", cohortId)
      .maybeSingle(),
    admin
      .from("cohort_participants")
      .select("user_id, role, status")
      .eq("cohort_id", cohortId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("cohort_partners")
      .select("id,name,logo_url,description,website_url,crm_account_id")
      .eq("cohort_id", cohortId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (contentResult.error) throw new Error(contentResult.error.message);
  if (participantResult.error) throw new Error(participantResult.error.message);
  if (partnerResult.error) throw new Error(partnerResult.error.message);

  const participantRows = (participantResult.data as CohortParticipantRow[] | null) ?? [];
  const participantUserIds = [...new Set(participantRows.map((row) => row.user_id))];
  const { data: profileRows, error: profileError } = participantUserIds.length
    ? await admin
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url, bio, links")
        .in("user_id", participantUserIds)
    : { data: [], error: null };

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileByUserId = new Map(
    ((profileRows as ProfileRow[] | null) ?? []).map((profile) => [profile.user_id, profile]),
  );

  const participants: ParticipantCard[] = participantRows
    .map((row) => {
      const profile = profileByUserId.get(row.user_id);
      if (!profile?.handle) return null;
      return {
        handle: profile.handle,
        displayName: profile.display_name ?? profile.handle,
        role: row.role ?? "participant",
        status: row.status,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        links: parseLinks(profile.links),
      };
    })
    .filter((value): value is ParticipantCard => Boolean(value));

  const partners: PartnerCard[] = ((partnerResult.data as CohortPartnerRow[] | null) ?? []).map((partner) => ({
    id: partner.id,
    name: partner.name,
    logoUrl: partner.logo_url,
    description: partner.description,
    websiteUrl: partner.website_url,
  }));

  return {
    cohort: cohortData as CohortRow,
    content: (contentResult.data as CohortContentRow | null) ?? null,
    participants,
    partners,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const record = await loadCohort(id);

  if (!record) {
    return {
      title: "Cohort Not Found",
      robots: { index: false, follow: false },
    };
  }

  const siteOrigin = getSiteOrigin();
  const permalink = `${siteOrigin}/cohorts/${record.cohort.slug ?? record.cohort.id}`;
  const description =
    record.cohort.theme_long?.slice(0, 200) ||
    `${record.cohort.name} · ${formatRange(record.cohort.start_at, record.cohort.end_at)}`;

  return {
    title: record.cohort.name,
    description,
    alternates: { canonical: permalink },
    openGraph: {
      title: record.cohort.name,
      description,
      url: permalink,
      type: "website",
      images: record.cohort.header_image_url ? [{ url: record.cohort.header_image_url }] : undefined,
    },
    twitter: {
      card: record.cohort.header_image_url ? "summary_large_image" : "summary",
      title: record.cohort.name,
      description,
      images: record.cohort.header_image_url ? [record.cohort.header_image_url] : undefined,
    },
  };
}

export default async function CohortLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await loadCohort(id);
  if (!record) notFound();

  const { cohort, content, participants, partners } = record;
  const schedule = normalizeSchedule(content?.schedule);
  const projects = normalizeProjects(content?.projects);
  const resources = normalizeResources(content?.resources);
  const quests = normalizeQuests(content?.notes);
  const landingPath = `/cohorts/${cohort.slug ?? cohort.id}`;

  const stats: StatItem[] = [
    { label: "Participants", value: String(participants.length) },
    { label: "Projects", value: String(projects.length) },
    { label: "Resources", value: String(resources.length) },
    { label: "Duration", value: computeDuration(cohort.start_at, cohort.end_at) },
  ];

  return (
    <article id="dashboard" className="container-custom py-6">
      <div className="space-y-6">
        <CohortDashboardNav />

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {cohort.header_image_url ? (
            <div className="relative h-56 w-full md:h-72">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cohort.header_image_url}
                alt={`${cohort.name} header`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
          ) : null}
          <div className="grid gap-4 p-5 md:grid-cols-[1.5fr_1fr] md:p-6">
            <header className="space-y-2">
              <p className="type-label-sm text-muted-foreground">{cohort.status}</p>
              <h1 className="type-display-md">{cohort.name}</h1>
              <p className="text-sm text-muted-foreground">{formatRange(cohort.start_at, cohort.end_at)}</p>
              {cohort.theme_long ? <p className="type-body-md max-w-3xl">{cohort.theme_long}</p> : null}
            </header>
            <div className="space-y-3">
              <CohortHeroCta cohortName={cohort.name} />
              <CohortLandingHostLink landingPath={landingPath} />
            </div>
          </div>
        </section>

        <section>
          <StatsCards stats={stats} />
        </section>

        <section id="schedule" className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="type-heading-lg">Schedule</h2>
          <ScheduleSection events={schedule} />
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="type-heading-lg">Quests</h2>
          <QuestBoard quests={quests} />
        </section>

        <section id="projects" className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="type-heading-lg">Projects</h2>
          <ProjectsCarousel projects={projects} />
        </section>

        <section id="resources" className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="type-heading-lg">Resources</h2>
          <ResourceBrowser resources={resources} />
        </section>

        <section id="participants" className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="type-heading-lg">Participants</h2>
          <ParticipantsGrid participants={participants} />
        </section>

        <section id="partners" className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="type-heading-lg">Partners</h2>
          <PartnersGrid partners={partners} />
        </section>
      </div>
    </article>
  );
}
