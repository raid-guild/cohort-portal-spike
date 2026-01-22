"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import { BadgePill } from "./BadgePill";
import { PaidStar } from "./PaidStar";

export function PeopleDirectory({
  people,
  paidUserIds = [],
}: {
  people: Profile[];
  paidUserIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("all");
  const paidSet = useMemo(() => new Set(paidUserIds), [paidUserIds]);

  const skills = useMemo(() => {
    const set = new Set<string>();
    people.forEach((person) => person.skills?.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [people]);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return people.filter((person) => {
      const matchesQuery =
        !normalized ||
        person.displayName.toLowerCase().includes(normalized) ||
        person.handle.toLowerCase().includes(normalized);
      const matchesSkill = skill === "all" || person.skills?.includes(skill);
      return matchesQuery && matchesSkill;
    });
  }, [people, query, skill]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm md:w-72"
        />
        <select
          value={skill}
          onChange={(event) => setSkill(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All skills</option>
          {skills.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((person) => (
          <Link
            key={person.handle}
            href={`/people/${person.handle}`}
            className="rounded-xl border border-border bg-card p-5 hover:bg-muted"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AvatarBubble
                  name={person.displayName || person.handle}
                  url={person.avatarUrl}
                />
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <span>{person.displayName}</span>
                    {person.userId && paidSet.has(person.userId) ? (
                      <PaidStar className="h-4 w-4" />
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">@{person.handle}</div>
                </div>
              </div>
              {person.location ? <BadgePill>{person.location}</BadgePill> : null}
            </div>
            {person.bio ? (
              <p className="mt-3 text-sm text-muted-foreground">{person.bio}</p>
            ) : null}
            {person.skills?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {person.skills.map((skillTag) => (
                  <BadgePill key={skillTag}>{skillTag}</BadgePill>
                ))}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
      {!filtered.length ? (
        <p className="text-sm text-muted-foreground">No matches. Try another search.</p>
      ) : null}
    </div>
  );
}

function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "RG";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function AvatarBubble({ name, url }: { name: string; url?: string }) {
  const [status, setStatus] = useState<"idle" | "loaded" | "error">("idle");
  const showAvatar = Boolean(url) && status === "loaded";

  useEffect(() => {
    setStatus("idle");
  }, [url]);

  return (
    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
      <span className={showAvatar ? "opacity-0" : "opacity-100"}>
        {getInitials(name)}
      </span>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className={`absolute inset-0 h-full w-full object-cover ${
            showAvatar ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      ) : null}
    </div>
  );
}
