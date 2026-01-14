 "use client";

import { useState } from "react";
import Link from "next/link";
import type { ModuleEntry } from "@/lib/types";
import { BadgePill } from "./BadgePill";
import { ModuleDialogTrigger } from "./ModuleDialogTrigger";
import { ModuleSummary, type SummaryPayload } from "./ModuleSummary";

function formatType(type: ModuleEntry["type"]) {
  return type === "embed" ? "embed" : "link";
}

export function ModuleCard({
  module,
  summaryOverride,
  surface,
  summaryParams,
  authToken,
}: {
  module: ModuleEntry;
  summaryOverride?: SummaryPayload | null;
  surface?: string;
  summaryParams?: Record<string, string>;
  authToken?: string | null;
}) {
  const usesDialog = module.presentation?.mode === "dialog" && module.url;
  const isInternalUrl = module.url?.startsWith("/");
  const showAction =
    module.presentation?.action !== "none" && Boolean(module.url);
  const [showDetails, setShowDetails] = useState(false);
  const heightClass =
    module.presentation?.height === "double" ? "md:min-h-[360px]" : "";
  return (
    <div
      className={`flex h-full flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm ${heightClass}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{module.title}</h3>
          <div className="flex items-center gap-2">
            {module.status ? <BadgePill>{module.status}</BadgePill> : null}
            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              aria-expanded={showDetails}
              aria-label={showDetails ? "Hide module details" : "Show module details"}
            >
              ?
            </button>
          </div>
        </div>
        <ModuleSummary
          module={module}
          override={summaryOverride}
          surface={surface}
          params={summaryParams}
          authToken={authToken}
        />
        {showDetails ? (
          <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
            {module.description ? (
              <p className="text-sm text-foreground">{module.description}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <BadgePill>{module.lane}</BadgePill>
              <BadgePill>{formatType(module.type)}</BadgePill>
              {module.requiresAuth ? <BadgePill>auth</BadgePill> : null}
            </div>
            {module.owner ? (
              <p className="mt-2">
                Owner: {module.owner.name}
                {module.owner.contact ? ` (${module.owner.contact})` : ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {showAction ? (
        <div className="mt-4 flex gap-3 text-sm">
          {usesDialog ? (
            <ModuleDialogTrigger module={module} authToken={authToken} />
          ) : module.url && isInternalUrl ? (
            <Link
              href={module.url}
              className="rounded-lg border border-border px-3 py-2 hover:bg-muted"
            >
              Open Module
            </Link>
          ) : module.url ? (
            <a
              href={module.url}
              className="rounded-lg border border-border px-3 py-2 hover:bg-muted"
              target="_blank"
              rel="noreferrer"
            >
              Open Module
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
