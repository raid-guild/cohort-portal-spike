"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
        aria-label="Toggle theme"
      >
        <span className="h-4 w-4" aria-hidden="true" />
        Theme
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <Image
        src={
          theme === "dark"
            ? "/iconography/magic/star.svg"
            : "/iconography/magic/moon.svg"
        }
        alt=""
        width={16}
        height={16}
        className="h-4 w-4"
      />
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
