"use client";

import { useMemo, useState } from "react";

const FIRST_NAMES = [
  "Aric",
  "Bram",
  "Caelin",
  "Doran",
  "Elowen",
  "Fiora",
  "Garrick",
  "Hilda",
  "Ivor",
  "Jora",
  "Kael",
  "Liora",
  "Mira",
  "Nolan",
  "Orin",
  "Perrin",
  "Quill",
  "Rowan",
  "Soren",
  "Tamsin",
];

const LAST_NAMES = [
  "Amberforge",
  "Brightshield",
  "Cinderwhisper",
  "Duskryn",
  "Emberhart",
  "Frostmantle",
  "Glimmerleaf",
  "Hawkridge",
  "Ironbound",
  "Jadebrook",
  "Kingscar",
  "Lightward",
  "Moonsong",
  "Nightbloom",
  "Oakenshield",
  "Ravenfall",
  "Silverwind",
  "Stormcaller",
  "Thornvale",
  "Windrider",
];

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  onApply?: (value: string) => void | Promise<void>;
  applyLabel?: string;
  authToken?: string | null;
  context?: string;
  bio?: string;
  compact?: boolean;
};

export function DisplayNameGenerator({
  value = "",
  onChange,
  onApply,
  applyLabel = "Apply to profile",
  authToken,
  context,
  bio,
  compact = false,
}: Props) {
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generateLocal = useMemo(
    () => () => {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const next = `${first} ${last}`;
      setSuggestion(next);
    },
    [],
  );

  const generateName = async () => {
    setError("");
    if (!authToken) {
      generateLocal();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/modules/profile-generators/generate-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ context, bio }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate name.");
      }
      setSuggestion(String(json.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate name.");
      generateLocal();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground ${
        compact ? "" : "mt-2"
      }`}
    >
      <div className="text-xs font-semibold text-foreground">
        Display name generator
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Generate a D&D-inspired display name.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generateName}
          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
        {suggestion ? (
          <>
            <span className="text-xs text-foreground">{suggestion}</span>
            {onChange ? (
              <button
                type="button"
                onClick={() => onChange(suggestion)}
                className="rounded-full border border-border bg-primary px-3 py-1 text-xs text-background hover:opacity-90"
              >
                Use name
              </button>
            ) : null}
            {onApply ? (
              <button
                type="button"
                onClick={() => onApply(suggestion)}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
              >
                {applyLabel}
              </button>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            Current: {value || "none"}
          </span>
        )}
      </div>
      {error ? (
        <div className="mt-2 text-xs text-muted-foreground">{error}</div>
      ) : null}
    </div>
  );
}
