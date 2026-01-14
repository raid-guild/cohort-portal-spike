"use client";

import { useMemo, useState } from "react";

type Props = {
  authToken?: string | null;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  context?: string;
  onUpdated?: (url: string) => void;
  compact?: boolean;
};

export function AvatarGenerator({
  authToken,
  displayName,
  bio,
  avatarUrl,
  context,
  onUpdated,
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleGenerate = useMemo(
    () => async () => {
      setMessage("");
      if (!authToken) {
        setMessage("Sign in to generate an avatar.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/modules/profile-generators/generate-avatar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ context, bio, displayName }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Avatar generation failed.");
        }
        if (json.url) {
          onUpdated?.(json.url);
        }
        setMessage("Avatar updated.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to generate.");
      } finally {
        setLoading(false);
      }
    },
    [authToken, bio, context, displayName, onUpdated],
  );

  return (
    <div
      className={`space-y-4 rounded-xl border border-border bg-card text-xs text-muted-foreground ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs text-muted-foreground">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            "No avatar"
          )}
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">Avatar generator</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a D&D-inspired portrait based on your bio.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          className="rounded-full border border-border bg-primary px-4 py-2 text-xs text-background hover:opacity-90"
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate avatar"}
        </button>
        {message ? (
          <span className="text-xs text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
