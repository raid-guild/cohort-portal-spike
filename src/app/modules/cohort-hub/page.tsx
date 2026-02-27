"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Cohort = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  start_at: string | null;
  end_at: string | null;
  theme_long: string | null;
  header_image_url: string | null;
};

type ScheduleItem = {
  day: number;
  date?: string;
  agenda?: string;
  notes?: string;
};

type ProjectItem = {
  name: string;
  description?: string;
  team?: string[];
};

type ResourceItem = {
  title: string;
  url?: string;
  type?: string;
};

type NoteItem = {
  title: string;
  body: string;
};

type CohortContent = {
  schedule?: ScheduleItem[];
  projects?: ProjectItem[];
  resources?: ResourceItem[];
  notes?: NoteItem[];
};

type EditMode = "edit" | "create";

const emptyContent: CohortContent = {
  schedule: [],
  projects: [],
  resources: [],
  notes: [],
};

const parseTeamList = (input: string) =>
  input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const readTeamList = (team?: string[]) => (team?.length ? team.join(", ") : "");

const getYouTubeVideoId = (url?: string) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return id || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return fromQuery;

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" && parts[1]) return parts[1];
      if (parts[0] === "embed" && parts[1]) return parts[1];
    }

    return null;
  } catch {
    return null;
  }
};

export default function CohortHubPage() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<CohortContent>(emptyContent);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>("edit");

  const [draftName, setDraftName] = useState("");
  const [draftStatus, setDraftStatus] = useState("active");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [draftThemeLong, setDraftThemeLong] = useState("");
  const [draftHeaderImageUrl, setDraftHeaderImageUrl] = useState("");
  const [draftSchedule, setDraftSchedule] = useState<ScheduleItem[]>([]);
  const [draftProjects, setDraftProjects] = useState<ProjectItem[]>([]);
  const [draftResources, setDraftResources] = useState<ResourceItem[]>([]);
  const [draftNotes, setDraftNotes] = useState<NoteItem[]>([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const selectedCohort = useMemo(
    () => cohorts.find((cohort) => cohort.id === selectedId) ?? null,
    [cohorts, selectedId],
  );

  const seedDraftFrom = (cohort: Cohort | null, data: CohortContent | null) => {
    setDraftName(cohort?.name ?? "");
    setDraftSlug(cohort?.slug ?? "");
    setDraftStatus(cohort?.status ?? "upcoming");
    setDraftStart(cohort?.start_at ? cohort.start_at.slice(0, 10) : "");
    setDraftEnd(cohort?.end_at ? cohort.end_at.slice(0, 10) : "");
    setDraftThemeLong(cohort?.theme_long ?? "");
    setDraftHeaderImageUrl(cohort?.header_image_url ?? "");
    setDraftSchedule(data?.schedule ?? []);
    setDraftProjects(data?.projects ?? []);
    setDraftResources(data?.resources ?? []);
    setDraftNotes(data?.notes ?? []);
  };

  const loadCohorts = useCallback(async (token: string) => {
    const res = await fetch("/api/cohorts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error ?? "Unable to load cohorts.");
    }
    setCohorts(json.cohorts ?? []);
    const first = json.cohorts?.[0]?.id ?? null;
    setSelectedId(first);
    return first;
  }, []);

  const loadCohortDetail = useCallback(async (token: string, id: string) => {
    const res = await fetch(`/api/cohorts/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error ?? "Unable to load cohort.");
    }

    const loadedContent = (json.content ?? emptyContent) as CohortContent;
    setContent(loadedContent);

    const cohort = (json.cohort ?? null) as Cohort | null;
    seedDraftFrom(cohort, loadedContent);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      setAuthToken(session.access_token);
      try {
        const [firstId] = await Promise.all([
          loadCohorts(session.access_token),
          fetch("/api/me/roles", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
            .then((res) => res.json())
            .then((json) => setIsHost((json.roles ?? []).includes("host")))
            .catch(() => setIsHost(false)),
        ]);
        if (firstId) {
          await loadCohortDetail(session.access_token, firstId);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to load cohorts.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    });
  }, [loadCohortDetail, loadCohorts, supabase]);

  useEffect(() => {
    if (!authToken || !selectedId) return;
    loadCohortDetail(authToken, selectedId).catch((err) => {
      const msg = err instanceof Error ? err.message : "Unable to load cohort.";
      setError(msg);
    });
  }, [authToken, loadCohortDetail, selectedId]);

  const openCreateEditor = () => {
    setEditMode("create");
    seedDraftFrom(null, emptyContent);
    setEditorOpen(true);
  };

  const openEditEditor = () => {
    setEditMode("edit");
    seedDraftFrom(selectedCohort, content);
    setEditorOpen(true);
  };

  const buildPayload = () => ({
    name: draftName.trim() || "New Cohort",
    slug: draftSlug.trim() || null,
    status: draftStatus,
    startAt: draftStart || null,
    endAt: draftEnd || null,
    themeLong: draftThemeLong.trim() || null,
    headerImageUrl: draftHeaderImageUrl.trim() || null,
    content: {
      schedule: draftSchedule,
      projects: draftProjects,
      resources: draftResources,
      notes: draftNotes,
    },
  });

  const saveDraft = async () => {
    if (!authToken) return;

    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload();

      if (editMode === "create") {
        const res = await fetch("/api/cohorts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error ?? "Unable to create cohort.");
        }
        await loadCohorts(authToken);
        if (json.cohort?.id) {
          setSelectedId(json.cohort.id as string);
          await loadCohortDetail(authToken, json.cohort.id as string);
        }
      } else {
        if (!selectedId) {
          throw new Error("No cohort selected.");
        }

        const res = await fetch(`/api/cohorts/${selectedId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error ?? "Unable to save cohort.");
        }

        setContent(payload.content);
        setCohorts((prev) =>
          prev.map((cohort) =>
            cohort.id === selectedId
              ? {
                  ...cohort,
                  name: payload.name,
                  slug: payload.slug,
                  status: payload.status,
                  start_at: payload.startAt,
                  end_at: payload.endAt,
                  theme_long: payload.themeLong,
                  header_image_url: payload.headerImageUrl,
                }
              : cohort,
          ),
        );
      }

      setEditorOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to save.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const formatRange = (cohort: Cohort) => {
    if (!cohort.start_at && !cohort.end_at) return "Dates TBD";
    const start = cohort.start_at ? new Date(cohort.start_at) : null;
    const end = cohort.end_at ? new Date(cohort.end_at) : null;
    return `${start ? start.toLocaleDateString() : "TBD"} -> ${
      end ? end.toLocaleDateString() : "TBD"
    }`;
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Cohort Hub</h1>
        <p className="text-sm text-muted-foreground">
          Schedule, projects, resources, and notes for the current cohort.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading cohorts...</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr,2fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Cohorts</div>
            {isHost ? (
              <button
                type="button"
                className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                onClick={openCreateEditor}
              >
                New
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            {cohorts.length ? (
              cohorts.map((cohort) => (
                <button
                  key={cohort.id}
                  type="button"
                  onClick={() => setSelectedId(cohort.id)}
                  className={`w-full rounded-lg border border-border px-3 py-2 text-left ${
                    cohort.id === selectedId ? "bg-muted" : "hover:bg-muted"
                  }`}
                >
                  <div className="text-sm font-semibold text-foreground">{cohort.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatRange(cohort)} · {cohort.status}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No cohorts yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {selectedCohort?.header_image_url ? (
              <div className="mb-4 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedCohort.header_image_url}
                  alt={`${selectedCohort.name} header`}
                  className="h-44 w-full object-cover"
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Schedule</div>
              {isHost ? (
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                  onClick={openEditEditor}
                  disabled={!selectedId}
                >
                  Manage
                </button>
              ) : null}
            </div>
            <div className="mt-3 space-y-3 text-xs text-muted-foreground">
              {selectedCohort?.theme_long ? (
                <p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                  {selectedCohort.theme_long}
                </p>
              ) : null}
              {selectedId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/cohorts/${selectedCohort?.slug || selectedId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs underline-offset-4 hover:underline"
                  >
                    Public landing page: /cohorts/{selectedCohort?.slug || selectedId}
                  </a>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    onClick={async () => {
                      const path = `/cohorts/${selectedCohort?.slug || selectedId}`;
                      const origin =
                        typeof window !== "undefined" ? window.location.origin : "";
                      await navigator.clipboard.writeText(`${origin}${path}`);
                      setCopyMessage("Copied");
                      setTimeout(() => setCopyMessage(null), 1500);
                    }}
                  >
                    Copy link
                  </button>
                  {copyMessage ? <span className="text-xs text-emerald-600">{copyMessage}</span> : null}
                </div>
              ) : null}
              {content.schedule?.length ? (
                content.schedule.map((day) => (
                  <div key={`${day.day}-${day.date ?? ""}`} className="rounded-lg border border-border bg-background p-3">
                    <div className="text-xs font-semibold text-foreground">
                      Day {day.day}
                      {day.date ? ` · ${day.date}` : ""}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{day.agenda ?? "Agenda TBD"}</div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Schedule coming soon.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Projects</div>
                {isHost ? (
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                    onClick={openEditEditor}
                    disabled={!selectedId}
                  >
                    Manage
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {content.projects?.length ? (
                  content.projects.map((project, index) => (
                    <div key={`${project.name}-${index}`} className="rounded-lg border p-3">
                      <div className="text-xs font-semibold text-foreground">{project.name}</div>
                      {project.description ? (
                        <p className="mt-2 text-xs text-muted-foreground">{project.description}</p>
                      ) : null}
                      {project.team?.length ? (
                        <div className="mt-2 text-xs text-muted-foreground">Team: {project.team.join(", ")}</div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Projects will show up here.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Resources</div>
                {isHost ? (
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                    onClick={openEditEditor}
                    disabled={!selectedId}
                  >
                    Manage
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {content.resources?.length ? (
                  content.resources.map((resource, index) => {
                    const ytId = getYouTubeVideoId(resource.url);
                    return (
                      <div key={`${resource.title}-${index}`} className="rounded-lg border p-3">
                        <div className="text-xs font-semibold text-foreground">{resource.title}</div>
                        {resource.url ? (
                          <a
                            href={resource.url}
                            className="mt-1 inline-block break-all text-xs underline-offset-4 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {resource.url}
                          </a>
                        ) : null}
                        {resource.type ? <div className="mt-1 text-xs text-muted-foreground">{resource.type}</div> : null}
                        {ytId ? (
                          <div className="mt-3 overflow-hidden rounded-md border border-border">
                            <iframe
                              title={`${resource.title} video`}
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
                  <p className="text-xs text-muted-foreground">Resources will show up here.</p>
                )}
              </div>
            </div>
          </div>

          {isHost && content.notes?.length ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Host notes</div>
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                  onClick={openEditEditor}
                  disabled={!selectedId}
                >
                  Manage
                </button>
              </div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {content.notes.map((note, index) => (
                  <div key={`${note.title}-${index}`} className="rounded-lg border p-3">
                    <div className="text-xs font-semibold text-foreground">{note.title}</div>
                    <p className="mt-2 text-xs text-muted-foreground">{note.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {isHost && editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                {editMode === "create" ? "Create Cohort" : "Manage Cohort"}
              </div>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                onClick={() => setEditorOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Cohort name
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Public slug
                  <input
                    value={draftSlug}
                    onChange={(event) => setDraftSlug(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    placeholder="cohort-xiii"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Status
                  <select
                    value={draftStatus}
                    onChange={(event) => setDraftStatus(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="active">active</option>
                    <option value="upcoming">upcoming</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
              </div>
              <label className="text-xs text-muted-foreground">
                Theme long text
                <textarea
                  value={draftThemeLong}
                  onChange={(event) => setDraftThemeLong(event.target.value)}
                  className="mt-2 min-h-[96px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="Public-facing cohort description for landing page and social unfurls."
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Header image URL
                <input
                  value={draftHeaderImageUrl}
                  onChange={(event) => setDraftHeaderImageUrl(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="https://..."
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Start date
                  <input
                    type="date"
                    value={draftStart}
                    onChange={(event) => setDraftStart(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  End date
                  <input
                    type="date"
                    value={draftEnd}
                    onChange={(event) => setDraftEnd(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">Schedule</div>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    onClick={() =>
                      setDraftSchedule((prev) => [
                        ...prev,
                        { day: prev.length + 1, date: "", agenda: "", notes: "" },
                      ])
                    }
                  >
                    Add day
                  </button>
                </div>
                <div className="space-y-3">
                  {draftSchedule.map((item, index) => (
                    <div key={`schedule-${index}`} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-4">
                      <label className="text-xs">
                        Day
                        <input
                          type="number"
                          value={item.day}
                          onChange={(event) =>
                            setDraftSchedule((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, day: Number(event.target.value) || 1 }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <label className="text-xs">
                        Date label
                        <input
                          value={item.date ?? ""}
                          onChange={(event) =>
                            setDraftSchedule((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, date: event.target.value } : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <label className="text-xs md:col-span-2">
                        Agenda
                        <input
                          value={item.agenda ?? ""}
                          onChange={(event) =>
                            setDraftSchedule((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, agenda: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <div className="md:col-span-4">
                        <button
                          type="button"
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() =>
                            setDraftSchedule((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                          }
                        >
                          Remove day
                        </button>
                      </div>
                    </div>
                  ))}
                  {!draftSchedule.length ? (
                    <p className="text-xs text-muted-foreground">No schedule rows yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">Projects</div>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    onClick={() =>
                      setDraftProjects((prev) => [
                        ...prev,
                        { name: "", description: "", team: [] },
                      ])
                    }
                  >
                    Add project
                  </button>
                </div>
                <div className="space-y-3">
                  {draftProjects.map((project, index) => (
                    <div key={`project-${index}`} className="grid gap-2 rounded-md border border-border p-3">
                      <label className="text-xs">
                        Name
                        <input
                          value={project.name}
                          onChange={(event) =>
                            setDraftProjects((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, name: event.target.value } : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <label className="text-xs">
                        Description
                        <input
                          value={project.description ?? ""}
                          onChange={(event) =>
                            setDraftProjects((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, description: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <label className="text-xs">
                        Team (comma-separated)
                        <input
                          value={readTeamList(project.team)}
                          onChange={(event) =>
                            setDraftProjects((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, team: parseTeamList(event.target.value) }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <div>
                        <button
                          type="button"
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() =>
                            setDraftProjects((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                          }
                        >
                          Remove project
                        </button>
                      </div>
                    </div>
                  ))}
                  {!draftProjects.length ? (
                    <p className="text-xs text-muted-foreground">No projects yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">Resources</div>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    onClick={() =>
                      setDraftResources((prev) => [
                        ...prev,
                        { title: "", url: "", type: "" },
                      ])
                    }
                  >
                    Add resource
                  </button>
                </div>
                <div className="space-y-3">
                  {draftResources.map((resource, index) => (
                    <div key={`resource-${index}`} className="grid gap-2 rounded-md border border-border p-3">
                      <label className="text-xs">
                        Title
                        <input
                          value={resource.title}
                          onChange={(event) =>
                            setDraftResources((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, title: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <label className="text-xs">
                        URL
                        <input
                          value={resource.url ?? ""}
                          onChange={(event) =>
                            setDraftResources((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, url: event.target.value } : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <label className="text-xs">
                        Type
                        <input
                          value={resource.type ?? ""}
                          onChange={(event) =>
                            setDraftResources((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, type: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <div>
                        <button
                          type="button"
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() =>
                            setDraftResources((prev) =>
                              prev.filter((_, rowIndex) => rowIndex !== index),
                            )
                          }
                        >
                          Remove resource
                        </button>
                      </div>
                    </div>
                  ))}
                  {!draftResources.length ? (
                    <p className="text-xs text-muted-foreground">No resources yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">Host notes</div>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    onClick={() =>
                      setDraftNotes((prev) => [...prev, { title: "", body: "" }])
                    }
                  >
                    Add note
                  </button>
                </div>
                <div className="space-y-3">
                  {draftNotes.map((note, index) => (
                    <div key={`note-${index}`} className="grid gap-2 rounded-md border border-border p-3">
                      <label className="text-xs">
                        Title
                        <input
                          value={note.title}
                          onChange={(event) =>
                            setDraftNotes((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, title: event.target.value } : row,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <label className="text-xs">
                        Body
                        <textarea
                          value={note.body}
                          onChange={(event) =>
                            setDraftNotes((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, body: event.target.value } : row,
                              ),
                            )
                          }
                          className="mt-1 min-h-[80px] w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </label>
                      <div>
                        <button
                          type="button"
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() =>
                            setDraftNotes((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                          }
                        >
                          Remove note
                        </button>
                      </div>
                    </div>
                  ))}
                  {!draftNotes.length ? (
                    <p className="text-xs text-muted-foreground">No host notes yet.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-lg border border-border bg-primary px-4 py-2 text-xs text-background hover:opacity-90"
                onClick={saveDraft}
                disabled={saving}
              >
                {saving ? "Saving..." : editMode === "create" ? "Create cohort" : "Save changes"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-xs hover:bg-muted"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
