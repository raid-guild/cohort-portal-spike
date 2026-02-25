"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { SkillsGraph } from "./SkillsGraph";

type ViewTier = "public" | "authenticated" | "dao-member";

type CountEntry = {
  label: string;
  count: number;
};

type SkillsViewPayload = {
  tier: ViewTier;
  stats: {
    people: number;
    uniqueSkills: number;
    uniqueRoles: number;
  };
  topSkills: CountEntry[];
  topRoles: CountEntry[];
  skillIndex: string[];
  people: {
    handle: string;
    displayName: string;
    skills: string[];
    roles: string[];
  }[];
};

function formatPeopleForGraph(
  people: SkillsViewPayload["people"],
): Pick<Profile, "handle" | "displayName" | "skills" | "roles">[] {
  return people.map((person) => ({
    handle: person.handle,
    displayName: person.displayName,
    skills: person.skills,
    roles: person.roles,
  }));
}

export function SkillsExplorer() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [data, setData] = useState<SkillsViewPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let requestSeq = 0;
    let activeController: AbortController | null = null;

    const load = async () => {
      const seq = ++requestSeq;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/modules/skills-explorer/view", {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          throw new Error("Unable to load Skills Explorer data.");
        }
        const json = (await res.json()) as SkillsViewPayload;
        if (cancelled || seq !== requestSeq) return;
        setData(json);
        setError("");
      } catch (err) {
        if (
          cancelled ||
          seq !== requestSeq ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load Skills Explorer data.");
      }
    };

    void load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      activeController?.abort();
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Loading skills data...
      </div>
    );
  }

  const graphPeople = formatPeopleForGraph(data.people);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">People</div>
          <div className="text-2xl font-semibold">{data.stats.people}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Unique skills</div>
          <div className="text-2xl font-semibold">{data.stats.uniqueSkills}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Unique roles</div>
          <div className="text-2xl font-semibold">{data.stats.uniqueRoles}</div>
        </div>
      </div>

      {data.tier === "dao-member" ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Skill & Role Graph</h2>
            <p className="text-xs text-muted-foreground">
              DAO member view: includes person-to-skill mappings.
            </p>
          </div>
          <div className="mt-4 h-[520px] overflow-hidden rounded-xl border border-border bg-background">
            <SkillsGraph people={graphPeople} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Skill & Role Graph</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This view is anonymized. Person-level skill mappings are shown only to DAO
            members.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Top Skills</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.topSkills.map((entry) => (
            <div
              key={entry.label}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
            >
              <span>{entry.label}</span>
              <span className="text-muted-foreground">{entry.count}</span>
            </div>
          ))}
        </div>
      </div>

      {data.tier !== "public" ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Top Roles</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.topRoles.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
              >
                <span>{entry.label}</span>
                <span className="text-muted-foreground">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Skill Index</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
          {data.skillIndex.map((skill) => (
            <span key={skill} className="rounded-full border border-border px-3 py-1">
              {skill}
            </span>
          ))}
          {!data.skillIndex.length ? (
            <span className="text-muted-foreground">
              No skills yet. Add them on your profile.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
