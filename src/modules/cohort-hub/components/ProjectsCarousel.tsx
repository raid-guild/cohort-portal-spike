"use client";

import { useRef } from "react";
import type { ProjectCard } from "@/modules/cohort-hub/landing-types";

export function ProjectsCarousel({ projects }: { projects: ProjectCard[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollByCard = (direction: "next" | "prev") => {
    const node = trackRef.current;
    if (!node) return;
    const amount = Math.max(280, Math.floor(node.clientWidth * 0.8));
    node.scrollBy({ left: direction === "next" ? amount : -amount, behavior: "smooth" });
  };

  if (!projects.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Projects coming soon.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollByCard("prev")}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          aria-label="Previous projects"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => scrollByCard("next")}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          aria-label="Next projects"
        >
          Next
        </button>
      </div>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        aria-label="Projects carousel"
      >
        {projects.map((project) => (
          <article
            key={project.id}
            className="w-[min(90vw,360px)] flex-none snap-start rounded-xl border border-border bg-card p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
          >
            <h3 className="font-semibold">{project.title}</h3>
            {project.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
            ) : null}
            {project.links.length ? (
              <div className="mt-3 space-y-1">
                {project.links.map((link) => (
                  <a
                    key={`${project.id}-${link}`}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-xs underline-offset-4 hover:underline"
                  >
                    {link}
                  </a>
                ))}
              </div>
            ) : null}
            {project.notes ? <p className="mt-3 text-xs text-muted-foreground">{project.notes}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
