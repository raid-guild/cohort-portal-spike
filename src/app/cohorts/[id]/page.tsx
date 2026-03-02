import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { CohortLandingReferralForm } from "@/modules/cohort-hub/CohortLandingReferralForm";
import { CohortLandingHostLink } from "@/modules/cohort-hub/CohortLandingHostLink";

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

type ScheduleItem = {
  day?: number;
  date?: string;
  agenda?: string;
};

type ProjectItem = {
  name?: string;
  description?: string;
  team?: string[];
};

type ResourceItem = {
  title?: string;
  url?: string;
  type?: string;
};

type CohortContentRow = {
  schedule: ScheduleItem[] | null;
  projects: ProjectItem[] | null;
  resources: ResourceItem[] | null;
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

function getYouTubeVideoId(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "shorts" || parts[0] === "embed") && parts[1]) return parts[1];
    }
    return null;
  } catch {
    return null;
  }
}

async function loadCohort(
  id: string,
): Promise<{
  cohort: CohortRow;
  content: CohortContentRow | null;
  participants: {
    handle: string;
    displayName: string;
    role: string | null;
    status: string;
  }[];
  partners: CohortPartnerRow[];
} | null> {
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
      .select("schedule,projects,resources")
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
        .select("user_id, handle, display_name")
        .in("user_id", participantUserIds)
    : { data: [], error: null };

  if (profileError) {
    throw new Error(profileError.message);
  }
  const profileByUserId = new Map(
    (profileRows ?? []).map((profile) => [profile.user_id, profile]),
  );

  const participants = participantRows
    .map((row) => {
      const profile = profileByUserId.get(row.user_id);
      if (!profile?.handle) return null;
      return {
        handle: profile.handle,
        displayName: profile.display_name ?? profile.handle,
        role: row.role,
        status: row.status,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return {
    cohort: cohortData as CohortRow,
    content: (contentResult.data as CohortContentRow | null) ?? null,
    participants,
    partners: (partnerResult.data as CohortPartnerRow[] | null) ?? [],
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

  const { cohort, content } = record;
  const { participants, partners } = record;
  const projects = content?.projects ?? [];
  const resources = content?.resources ?? [];
  const schedule = content?.schedule ?? [];
  const landingPath = `/cohorts/${cohort.slug ?? cohort.id}`;

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      {cohort.header_image_url ? (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cohort.header_image_url}
            alt={`${cohort.name} header`}
            className="h-auto max-h-[420px] w-full object-cover"
          />
        </div>
      ) : null}

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{cohort.status}</p>
        <h1 className="text-4xl font-semibold leading-tight">{cohort.name}</h1>
        <p className="text-sm text-muted-foreground">
          {formatRange(cohort.start_at, cohort.end_at)}
        </p>
        {cohort.theme_long ? <p className="text-base text-foreground">{cohort.theme_long}</p> : null}
      </header>

      <CohortLandingHostLink landingPath={landingPath} />

      <CohortLandingReferralForm cohortId={cohort.id} cohortName={cohort.name} />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Projects</h2>
          <div className="mt-3 space-y-3 text-sm">
            {projects.length ? (
              projects.map((project, index) => (
                <div key={`${project.name ?? "project"}-${index}`} className="rounded-lg border p-3">
                  <p className="font-medium">{project.name ?? "Untitled project"}</p>
                  {project.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                  ) : null}
                  {project.team?.length ? (
                    <p className="mt-2 text-xs text-muted-foreground">Team: {project.team.join(", ")}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Projects coming soon.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Schedule</h2>
          <div className="mt-3 space-y-3 text-sm">
            {schedule.length ? (
              schedule.map((item, index) => (
                <div key={`${item.day ?? index}-${item.date ?? ""}`} className="rounded-lg border p-3">
                  <p className="font-medium">
                    Day {item.day ?? index + 1}
                    {item.date ? ` · ${item.date}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.agenda ?? "Agenda TBD"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Schedule coming soon.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Resources</h2>
        <div className="mt-3 space-y-3 text-sm">
          {resources.length ? (
            resources.map((resource, index) => {
              const ytId = getYouTubeVideoId(resource.url);
              return (
                <div key={`${resource.title ?? "resource"}-${index}`} className="rounded-lg border p-3">
                  <p className="font-medium">{resource.title ?? "Untitled resource"}</p>
                  {resource.url ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block break-all text-sm underline-offset-4 hover:underline"
                    >
                      {resource.url}
                    </a>
                  ) : null}
                  {resource.type ? <p className="mt-1 text-xs text-muted-foreground">{resource.type}</p> : null}
                  {ytId ? (
                    <div className="mt-3 overflow-hidden rounded-md border border-border">
                      <iframe
                        title={`${resource.title ?? "Resource"} video`}
                        src={`https://www.youtube.com/embed/${ytId}`}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">Resources coming soon.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Participants</h2>
          <div className="mt-3 space-y-3 text-sm">
            {participants.length ? (
              participants.map((participant, index) => (
                <div key={`${participant.handle}-${index}`} className="rounded-lg border p-3">
                  <a
                    href={`/people/${participant.handle}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {participant.displayName}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    @{participant.handle}
                    {participant.role ? ` · ${participant.role}` : ""}
                    {participant.status ? ` · ${participant.status}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Participant list coming soon.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Partners</h2>
          <div className="mt-3 space-y-3 text-sm">
            {partners.length ? (
              partners.map((partner) => (
                <div key={partner.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-3">
                    {partner.logo_url ? (
                      <div className="flex h-14 w-32 items-center justify-center rounded-md border border-border bg-muted/30 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={partner.logo_url}
                          alt={`${partner.name} logo`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : null}
                    <div>
                      <p className="font-medium">{partner.name}</p>
                      {partner.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{partner.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {partner.website_url ? (
                    <a
                      href={partner.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Visit website
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Partners coming soon.</p>
            )}
          </div>
        </div>
      </section>
    </article>
  );
}
