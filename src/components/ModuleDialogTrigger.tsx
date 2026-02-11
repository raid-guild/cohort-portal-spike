"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ModuleEntry } from "@/lib/types";
import { portalOpenModuleEvent, registerPortalIframe } from "./PortalRpcBroker";

export function ModuleDialogTrigger({
  module,
  authToken,
}: {
  module: ModuleEntry;
  authToken?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [openParams, setOpenParams] = useState<Record<string, string> | null>(null);
  const height = module.presentation?.iframe?.height ?? 720;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeSrc = useMemo(() => {
    if (!module.url) return "";
    try {
      const url = new URL(module.url, window.location.origin);
      if (openParams) {
        Object.entries(openParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }
      url.searchParams.set("embed", "1");
      return url.toString();
    } catch {
      return module.url;
    }
  }, [module.url, openParams]);

  useEffect(() => {
    if (!open || !authToken || !iframeRef.current) {
      return;
    }
    iframeRef.current.contentWindow?.postMessage(
      { type: "portal-auth-token", token: authToken },
      window.location.origin,
    );
  }, [open, authToken]);

  useEffect(() => {
    if (open && iframeRef.current?.contentWindow) {
      registerPortalIframe(module.id, iframeRef.current.contentWindow);
    }
    if (!open) {
      registerPortalIframe(module.id, null);
    }
  }, [open, module.id]);

  useEffect(() => {
    return () => {
      registerPortalIframe(module.id, null);
    };
  }, [module.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ moduleId?: string; params?: Record<string, string> }>)
        .detail;
      if (detail?.moduleId !== module.id) return;
      setOpenParams(detail.params ?? null);
      setOpen(true);
    };
    window.addEventListener(portalOpenModuleEvent, handler as EventListener);
    return () => {
      window.removeEventListener(portalOpenModuleEvent, handler as EventListener);
    };
  }, [module.id]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpenParams(null);
          setOpen(true);
        }}
        className="rounded-lg border border-border px-3 py-2 hover:bg-muted"
      >
        {module.presentation?.actionLabel ?? "Open Module"}
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
                  if (!iframeRef.current) return;
                  registerPortalIframe(module.id, iframeRef.current.contentWindow);
                  if (!authToken) return;
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
