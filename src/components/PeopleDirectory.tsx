"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Profile } from "@/lib/types";
import type { BadgeDefinition, UserBadgePreview } from "@/lib/badges";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { RAID_GUILD_ROLES } from "@/lib/raidguild-roles";
import { BadgePill } from "./BadgePill";
import { PaidStar } from "./PaidStar";

export function PeopleDirectory({
  people,
  paidUserIds = [],
  daoMemberUserIds = [],
  userBadgesByUserId = {},
  badgeOptions = [],
}: {
  people: Profile[];
  paidUserIds?: string[];
  daoMemberUserIds?: string[];
  userBadgesByUserId?: Record<string, UserBadgePreview[]>;
  badgeOptions?: BadgeDefinition[];
}) {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("all");
  const [badgeId, setBadgeId] = useState("all");
  const [remoteResults, setRemoteResults] = useState<Profile[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const paidSet = useMemo(() => new Set(paidUserIds), [paidUserIds]);
  const daoMemberSet = useMemo(() => new Set(daoMemberUserIds), [daoMemberUserIds]);

  const skills = useMemo(() => {
    const set = new Set<string>();
    people.forEach((person) => person.skills?.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [people]);

  const filteredLocal = useMemo(() => {
    const normalized = query.toLowerCase();
    return people.filter((person) => {
      const matchesQuery =
        !normalized ||
        person.displayName.toLowerCase().includes(normalized) ||
        person.handle.toLowerCase().includes(normalized);
      const matchesSkill = skill === "all" || person.skills?.includes(skill);
      const userBadgeIds =
        person.userId && userBadgesByUserId[person.userId]
          ? userBadgesByUserId[person.userId].map((badge) => badge.id)
          : [];
      const matchesBadge = badgeId === "all" || userBadgeIds.includes(badgeId);
      return matchesQuery && matchesSkill && matchesBadge;
    });
  }, [badgeId, people, query, skill, userBadgesByUserId]);

  const shouldUseRemote = query.trim().length >= 2;

  useEffect(() => {
    if (!shouldUseRemote) {
      setRemoteResults(null);
      setRemoteLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setRemoteLoading(true);

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("q", query.trim());
      params.set("limit", "80");
      if (skill !== "all") {
        params.set("skill", skill);
      }
      if (badgeId !== "all") {
        params.set("badge", badgeId);
      }

      fetch(`/api/people/search?${params.toString()}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((payload: { people?: Profile[] }) => {
          if (cancelled) return;
          setRemoteResults(payload.people ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setRemoteResults([]);
        })
        .finally(() => {
          if (cancelled) return;
          setRemoteLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [badgeId, query, shouldUseRemote, skill]);

  const filtered = shouldUseRemote ? (remoteResults ?? []) : filteredLocal;

  const roleIconMap = useMemo(() => {
    return new Map(RAID_GUILD_ROLES.map((role) => [role.name, role.icon]));
  }, []);

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
        <select
          value={badgeId}
          onChange={(event) => setBadgeId(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All badges</option>
          {badgeOptions.map((badge) => (
            <option key={badge.id} value={badge.id}>
              {badge.title}
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
                <div>
                  <div className="flex items-start gap-2">
                    <ProfileIdentity
                      handle={person.handle}
                      displayName={person.displayName}
                      avatarUrl={person.avatarUrl}
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                    {person.userId && paidSet.has(person.userId) ? (
                      <PaidStar className="h-4 w-4" />
                    ) : null}
                    {person.userId && daoMemberSet.has(person.userId) ? (
                      <BadgePill>DAO</BadgePill>
                    ) : null}
                  </div>
                  {person.roles?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {person.roles.map((role) => {
                        const icon = roleIconMap.get(role);
                        return (
                          <div
                            key={role}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted"
                            title={role}
                          >
                            {icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={icon} alt={role} className="h-6 w-6" />
                            ) : (
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                {role.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {person.userId && userBadgesByUserId[person.userId]?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {userBadgesByUserId[person.userId].slice(0, 3).map((badge) => (
                        <span
                          key={badge.id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px]"
                        >
                          {badge.image_url ? (
                            <Image
                              src={badge.image_url}
                              alt={badge.title}
                              width={14}
                              height={14}
                              className="h-3.5 w-3.5 rounded"
                            />
                          ) : null}
                          <span>{badge.title}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
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
      {remoteLoading ? (
        <p className="text-sm text-muted-foreground">Searching people...</p>
      ) : null}
      {!filtered.length ? (
        <p className="text-sm text-muted-foreground">No matches. Try another search.</p>
      ) : null}
    </div>
  );
}
