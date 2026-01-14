"use client";

import { useEffect, useRef, useState } from "react";
import type { ModuleEntry } from "@/lib/types";

export function ModuleDialogTrigger({
  module,
  authToken,
}: {
  module: ModuleEntry;
  authToken?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const height = module.presentation?.iframe?.height ?? 720;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeSrc = module.url
    ? module.url.includes("?")
      ? `${module.url}&embed=1`
      : `${module.url}?embed=1`
    : "";

  useEffect(() => {
    if (!open || !authToken || !iframeRef.current) {
      return;
    }
    iframeRef.current.contentWindow?.postMessage(
      { type: "portal-auth-token", token: authToken },
      window.location.origin,
    );
  }, [open, authToken]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-3 py-2 hover:bg-muted"
      >
        Open Module
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">{module.title}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            {module.url ? (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title={module.title}
                className="w-full"
                style={{ height }}
                onLoad={() => {
                  if (!authToken || !iframeRef.current) return;
                  iframeRef.current.contentWindow?.postMessage(
                    { type: "portal-auth-token", token: authToken },
                    window.location.origin,
                  );
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
