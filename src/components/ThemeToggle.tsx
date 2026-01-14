"use client";

import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <img
        src={
          theme === "dark"
            ? "/iconography/magic/star.svg"
            : "/iconography/magic/moon.svg"
        }
        alt=""
        className="h-4 w-4"
      />
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
