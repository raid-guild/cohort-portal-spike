"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";
import { BadgePill } from "./BadgePill";
import { PaidStar } from "./PaidStar";

export function ProfileHeader({
  profile,
  portalRoles,
  isPaid,
  paidSource,
}: {
  profile: Profile;
  portalRoles?: string[];
  isPaid?: boolean;
  paidSource?: string | null;
}) {
  const initials = getInitials(profile.displayName || profile.handle);
  const [status, setStatus] = useState<"idle" | "loaded" | "error">("idle");
  const showAvatar = Boolean(profile.avatarUrl) && status === "loaded";

  useEffect(() => {
    setStatus("idle");
  }, [profile.avatarUrl]);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 md:flex-row md:items-center">
      <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground">
        <span className={showAvatar ? "opacity-0" : "opacity-100"}>{initials}</span>
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className={`absolute inset-0 h-full w-full object-cover ${
              showAvatar ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
          />
        ) : null}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
            {isPaid ? <PaidStar /> : null}
          </div>
          <span className="text-sm text-muted-foreground">@{profile.handle}</span>
        </div>
        {isPaid ? (
          <p className="text-xs text-muted-foreground">
            Paid subscriber{paidSource ? ` via ${paidSource}` : ""}.
          </p>
        ) : null}
        {profile.bio ? <p className="text-sm">{profile.bio}</p> : null}
        {portalRoles?.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="text-xs font-semibold text-foreground">Portal roles</span>
            {portalRoles.map((role) => (
              <BadgePill key={role}>{role}</BadgePill>
            ))}
          </div>
        ) : null}
        {profile.links?.length ? (
          <div className="flex flex-wrap gap-3 text-sm">
            {profile.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                className="underline-offset-4 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "RG";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}
