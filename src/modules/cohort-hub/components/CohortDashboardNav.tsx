"use client";

import { useTheme } from "@/lib/theme-context";

const LINKS = [
  { href: "#dashboard", label: "Dashboard" },
  { href: "#schedule", label: "Schedule" },
  { href: "#projects", label: "Projects" },
  { href: "#resources", label: "Resources" },
  { href: "#participants", label: "Participants" },
  { href: "#partners", label: "Partners" },
] as const;

export function CohortDashboardNav() {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="sticky top-2 z-30 rounded-2xl border border-border/80 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="#dashboard" className="font-semibold">
          RaidGuild Cohort Portal
        </a>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="underline-offset-4 hover:underline">
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <a href="/me" className="underline-offset-4 hover:underline">
            Profile
          </a>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-border px-2 py-1 hover:bg-muted"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>
    </nav>
  );
}
