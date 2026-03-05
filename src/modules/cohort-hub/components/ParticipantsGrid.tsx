"use client";

import { useMemo, useState } from "react";
import type { ParticipantCard } from "@/modules/cohort-hub/landing-types";

const FILTERS = ["all", "host", "mentor", "participant", "partner"] as const;
type RoleFilter = (typeof FILTERS)[number];

function normalizeRole(role: string) {
  const value = role.toLowerCase();
  if (value.includes("host")) return "host";
  if (value.includes("mentor")) return "mentor";
  if (value.includes("partner")) return "partner";
  return "participant";
}

export function ParticipantsGrid({ participants }: { participants: ParticipantCard[] }) {
  const [filter, setFilter] = useState<RoleFilter>("all");

  const visible = useMemo(() => {
    if (filter === "all") return participants;
    return participants.filter((participant) => normalizeRole(participant.role) === filter);
  }, [filter, participants]);

  if (!participants.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Participant list coming soon.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              filter === value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((participant) => (
          <article
            key={participant.handle}
            className="rounded-xl border border-border bg-card p-3 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              {participant.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={participant.avatarUrl}
                  alt={`${participant.displayName} avatar`}
                  className="h-10 w-10 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-sm">
                  {participant.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <a href={`/people/${participant.handle}`} className="font-semibold underline-offset-4 hover:underline">
                  {participant.displayName}
                </a>
                <p className="text-xs text-muted-foreground">@{participant.handle}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {participant.role} · {participant.status}
            </p>
            {participant.bio ? <p className="mt-2 text-sm text-muted-foreground">{participant.bio}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
