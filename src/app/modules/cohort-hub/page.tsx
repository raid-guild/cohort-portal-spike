"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Cohort = {
  id: string;
  name: string;
  status: string;
  start_at: string | null;
  end_at: string | null;
};

type CohortContent = {
  schedule?: Array<{ day: number; date?: string; agenda?: string; notes?: string }>;
  projects?: Array<{ name: string; description?: string; team?: string[] }>;
  resources?: Array<{ title: string; url?: string; type?: string }>;
  notes?: Array<{ title: string; body: string }>;
};

const emptyContent: CohortContent = {
  schedule: [],
  projects: [],
  resources: [],
  notes: [],
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

  const [draftName, setDraftName] = useState("");
  const [draftStatus, setDraftStatus] = useState("active");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [draftSchedule, setDraftSchedule] = useState("[]");
  const [draftProjects, setDraftProjects] = useState("[]");
  const [draftResources, setDraftResources] = useState("[]");
  const [draftNotes, setDraftNotes] = useState("[]");

  const loadCohorts = async (token: string) => {
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
  };

  const loadCohortDetail = async (token: string, id: string) => {
    const res = await fetch(`/api/cohorts/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error ?? "Unable to load cohort.");
    }
    setContent(json.content ?? emptyContent);
    if (json.cohort) {
      setDraftName(json.cohort.name ?? "");
      setDraftStatus(json.cohort.status ?? "active");
      setDraftStart(json.cohort.start_at ?? "");
      setDraftEnd(json.cohort.end_at ?? "");
    }
  };

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
  }, [supabase]);

  useEffect(() => {
    if (!authToken || !selectedId) return;
    loadCohortDetail(authToken, selectedId).catch((err) => {
      const msg = err instanceof Error ? err.message : "Unable to load cohort.";
      setError(msg);
    });
  }, [authToken, selectedId]);

  const handleSave = async () => {
    if (!authToken || !selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draftName,
        status: draftStatus,
        startAt: draftStart || null,
        endAt: draftEnd || null,
        content: {
          schedule: JSON.parse(draftSchedule || "[]"),
          projects: JSON.parse(draftProjects || "[]"),
          resources: JSON.parse(draftResources || "[]"),
          notes: JSON.parse(draftNotes || "[]"),
        },
      };
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
      setEditorOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to save.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!authToken) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draftName || "New Cohort",
        status: draftStatus || "upcoming",
        startAt: draftStart || null,
        endAt: draftEnd || null,
        content: {
          schedule: JSON.parse(draftSchedule || "[]"),
          projects: JSON.parse(draftProjects || "[]"),
          resources: JSON.parse(draftResources || "[]"),
          notes: JSON.parse(draftNotes || "[]"),
        },
      };
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
        setSelectedId(json.cohort.id);
        await loadCohortDetail(authToken, json.cohort.id);
      }
      setEditorOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to create cohort.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const formatRange = (cohort: Cohort) => {
    if (!cohort.start_at && !cohort.end_at) return "Dates TBD";
    const start = cohort.start_at ? new Date(cohort.start_at) : null;
    const end = cohort.end_at ? new Date(cohort.end_at) : null;
    return `${start ? start.toLocaleDateString() : "TBD"} → ${
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
                onClick={() => {
                  setDraftName("");
                  setDraftStatus("upcoming");
                  setDraftStart("");
                  setDraftEnd("");
                  setDraftSchedule("[]");
                  setDraftProjects("[]");
                  setDraftResources("[]");
                  setDraftNotes("[]");
                  setEditorOpen(true);
                }}
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
                  <div className="text-sm font-semibold text-foreground">
                    {cohort.name}
                  </div>
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
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Schedule</div>
              {isHost ? (
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                  onClick={() => setEditorOpen(true)}
                >
                  Edit
                </button>
              ) : null}
            </div>
            <div className="mt-3 space-y-3 text-xs text-muted-foreground">
              {content.schedule?.length ? (
                content.schedule.map((day) => (
                  <div
                    key={day.day}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="text-xs font-semibold text-foreground">
                      Day {day.day}
                      {day.date ? ` · ${day.date}` : ""}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {day.agenda ?? "Agenda TBD"}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Schedule coming soon.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <div className="text-sm font-semibold text-foreground">Projects</div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {content.projects?.length ? (
                  content.projects.map((project) => (
                    <div key={project.name} className="rounded-lg border p-3">
                      <div className="text-xs font-semibold text-foreground">
                        {project.name}
                      </div>
                      {project.description ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {project.description}
                        </p>
                      ) : null}
                      {project.team?.length ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Team: {project.team.join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Projects will show up here.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <div className="text-sm font-semibold text-foreground">Resources</div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {content.resources?.length ? (
                  content.resources.map((resource) => (
                    <div key={resource.title} className="rounded-lg border p-3">
                      <div className="text-xs font-semibold text-foreground">
                        {resource.title}
                      </div>
                      {resource.url ? (
                        <a
                          href={resource.url}
                          className="mt-1 inline-block text-xs underline-offset-4 hover:underline"
                        >
                          {resource.url}
                        </a>
                      ) : null}
                      {resource.type ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {resource.type}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Resources will show up here.
                  </p>
                )}
              </div>
            </div>
          </div>

          {isHost && content.notes?.length ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              <div className="text-sm font-semibold text-foreground">Host notes</div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {content.notes.map((note) => (
                  <div key={note.title} className="rounded-lg border p-3">
                    <div className="text-xs font-semibold text-foreground">
                      {note.title}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{note.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {isHost && editorOpen ? (
        <section className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">Host editor</div>
          <div className="mt-4 grid gap-4">
            <label className="text-xs text-muted-foreground">
              Cohort name
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
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
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Start date
                <input
                  type="date"
                  value={draftStart?.slice(0, 10) ?? ""}
                  onChange={(event) => setDraftStart(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                End date
                <input
                  type="date"
                  value={draftEnd?.slice(0, 10) ?? ""}
                  onChange={(event) => setDraftEnd(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
            <label className="text-xs text-muted-foreground">
              Schedule JSON
              <textarea
                value={draftSchedule}
                onChange={(event) => setDraftSchedule(event.target.value)}
                className="mt-2 min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Projects JSON
              <textarea
                value={draftProjects}
                onChange={(event) => setDraftProjects(event.target.value)}
                className="mt-2 min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Resources JSON
              <textarea
                value={draftResources}
                onChange={(event) => setDraftResources(event.target.value)}
                className="mt-2 min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Notes JSON (host-only)
              <textarea
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                className="mt-2 min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg border border-border bg-primary px-4 py-2 text-xs text-background hover:opacity-90"
              onClick={selectedId ? handleSave : handleCreate}
              disabled={saving}
            >
              {saving ? "Saving..." : selectedId ? "Save cohort" : "Create cohort"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-xs hover:bg-muted"
              onClick={() => setEditorOpen(false)}
            >
              Close
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
