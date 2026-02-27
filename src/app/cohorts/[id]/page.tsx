import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { CohortLandingReferralForm } from "@/modules/cohort-hub/CohortLandingReferralForm";

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
): Promise<{ cohort: CohortRow; content: CohortContentRow | null } | null> {
  const admin = supabaseAdminClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };

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

  const { data: contentData, error: contentError } = await admin
    .from("cohort_content")
    .select("schedule,projects,resources")
    .eq("cohort_id", id)
    .maybeSingle();

  if (contentError) {
    throw new Error(contentError.message);
  }

  return {
    cohort: cohortData as CohortRow,
    content: (contentData as CohortContentRow | null) ?? null,
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
  const projects = content?.projects ?? [];
  const resources = content?.resources ?? [];
  const schedule = content?.schedule ?? [];

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
    </article>
  );
}
