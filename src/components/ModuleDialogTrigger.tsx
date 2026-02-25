"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ModuleEntry } from "@/lib/types";
import { portalOpenModuleEvent, registerPortalIframe } from "./PortalRpcBroker";

type ParamTarget = "query" | "hash" | "both";

function applyParamsToHash(hash: string, entries: Array<[string, string]>) {
  if (!hash) return hash;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return hash;
  const queryIndex = raw.indexOf("?");
  const path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : raw.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  entries.forEach(([key, value]) => {
    params.set(key, value);
  });
  const nextQuery = params.toString();
  return `#${path}${nextQuery ? `?${nextQuery}` : ""}`;
}

function buildModuleUrl(
  moduleUrl: string,
  openParams: Record<string, string> | null,
  paramTarget: ParamTarget,
) {
  const url = new URL(moduleUrl, window.location.origin);
  const allParams: Array<[string, string]> = [];
  if (openParams) {
    Object.entries(openParams).forEach(([key, value]) => {
      allParams.push([key, value]);
    });
  }
  allParams.push(["embed", "1"]);
  allParams.push(["source", "cohort-portal"]);

  if (paramTarget === "query" || paramTarget === "both") {
    allParams.forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  if (paramTarget === "hash" || paramTarget === "both") {
    url.hash = applyParamsToHash(url.hash, allParams);
  }

  return url.toString();
}

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
  const paramTarget = (module.presentation?.iframe?.paramTarget ?? "query") as ParamTarget;
  const dialogSize = module.presentation?.dialog?.size ?? "md";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeSrc = useMemo(() => {
    if (!module.url) return "";
    try {
      return buildModuleUrl(module.url, openParams, paramTarget);
    } catch {
      return module.url;
    }
  }, [module.url, openParams, paramTarget]);
  const directHref = useMemo(() => {
    if (!module.url) return "";
    try {
      return new URL(module.url, window.location.origin).toString();
    } catch {
      return module.url;
    }
  }, [module.url]);

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

  const dialogWidthClass =
    dialogSize === "sm"
      ? "max-w-5xl"
      : dialogSize === "lg"
        ? "max-w-[min(96vw,1400px)]"
        : "max-w-[min(95vw,1240px)]";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 md:p-5">
          <div
            className={`w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl ${dialogWidthClass}`}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">{module.title}</div>
              <div className="flex items-center gap-3">
                {directHref ? (
                  <a
                    href={directHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open in new tab
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
            {module.url ? (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title={module.title}
                className="w-full"
                style={{ height: `min(${height}px, calc(92vh - 57px))` }}
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
