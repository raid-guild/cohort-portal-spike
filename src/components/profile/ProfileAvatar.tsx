"use client";

import { useEffect, useMemo, useState } from "react";

function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "RG";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

export function ProfileAvatar({
  name,
  url,
  size = 40,
  className = "",
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loaded" | "error">("idle");
  const showAvatar = Boolean(url) && status === "loaded";

  useEffect(() => {
    setStatus("idle");
  }, [url]);

  const initials = useMemo(() => getInitials(name), [name]);
  const style = { width: size, height: size };

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground ${className}`}
      style={style}
    >
      <span className={showAvatar ? "opacity-0" : "opacity-100"}>{initials}</span>
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
