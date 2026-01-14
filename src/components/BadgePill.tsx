import type { ReactNode } from "react";

export function BadgePill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-1 text-xs uppercase tracking-wide">
      {children}
    </span>
  );
}
