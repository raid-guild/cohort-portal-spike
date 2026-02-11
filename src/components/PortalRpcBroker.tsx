"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ModuleEntry } from "@/lib/types";
import {
  createPortalRpcResponse,
  isPortalRpcRequest,
  type PortalRpcRequest,
} from "@/lib/portal-rpc";
import { emitPortalToast } from "./PortalToastHost";

const OPEN_MODULE_EVENT = "portal-open-module";

type PortalRpcBrokerProps = {
  modules: ModuleEntry[];
  authToken?: string | null;
  sessionExpiresAt?: number | null;
  roles?: string[];
  entitlements?: string[];
};

type IframeRegistry = Map<string, Window>;

type PortalRpcOpenPayload = {
  moduleId?: string;
  surface?: "dialog" | "page";
  params?: Record<string, string>;
};

export function PortalRpcBroker({
  modules,
  authToken,
  sessionExpiresAt,
  roles = [],
  entitlements = [],
}: PortalRpcBrokerProps) {
  const router = useRouter();
  const iframeRegistry = useRef<IframeRegistry>(new Map());

  const moduleIndex = useMemo(() => {
    return new Map(modules.map((module) => [module.id, module]));
  }, [modules]);

  const registerIframe = useCallback((moduleId: string, win: Window | null) => {
    if (!win) {
      iframeRegistry.current.delete(moduleId);
      return;
    }
    iframeRegistry.current.set(moduleId, win);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Window & { __portalRegisterIframe?: typeof registerIframe }).__portalRegisterIframe =
      registerIframe;
    return () => {
      if ((window as Window & { __portalRegisterIframe?: typeof registerIframe }).__portalRegisterIframe) {
        delete (window as Window & { __portalRegisterIframe?: typeof registerIframe })
          .__portalRegisterIframe;
      }
    };
  }, [registerIframe]);

  const emitProfileRefresh = useCallback(() => {
    const stamp = new Date().toISOString();
    window.localStorage.setItem("profile-updated", stamp);
    window.postMessage({ type: "profile-updated" }, window.location.origin);
  }, []);

  const resolveModuleUrl = useCallback(
    (module: ModuleEntry, params?: Record<string, string>) => {
      if (!module.url) return null;
      try {
        const url = new URL(module.url, window.location.origin);
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
          });
        }
        return url;
      } catch {
        return null;
      }
    },
    [],
  );

  const canOpenModule = useCallback(
    (module: ModuleEntry) => {
      const requiresAuth = module.access?.requiresAuth || module.requiresAuth;
      if (requiresAuth && !authToken) return false;
      if (module.tags?.includes("hosts") && !roles.includes("host")) return false;
      const entitlement = module.access?.entitlement;
      if (entitlement && !entitlements.includes(entitlement)) return false;
      return true;
    },
    [authToken, entitlements, roles],
  );

  const handleModuleOpen = useCallback(
    (payload: PortalRpcOpenPayload) => {
      const moduleId = payload.moduleId;
      if (!moduleId) {
        return { ok: false, error: { code: "BAD_REQUEST", message: "moduleId required." } };
      }
      const module = moduleIndex.get(moduleId);
      if (!module) {
        return { ok: false, error: { code: "UNKNOWN_MODULE", message: "Unknown module." } };
      }
      if (!canOpenModule(module)) {
        return {
          ok: false,
          error: { code: "NOT_ALLOWED", message: "Module not available." },
        };
      }

      const surface = payload.surface ?? "dialog";
      if (surface === "dialog" && module.presentation?.mode === "dialog" && module.url) {
        window.dispatchEvent(
          new CustomEvent(OPEN_MODULE_EVENT, {
            detail: { moduleId, params: payload.params ?? null },
          }),
        );
        return { ok: true, result: { opened: true } };
      }

      const url = resolveModuleUrl(module, payload.params);
      if (!url) {
        return { ok: false, error: { code: "BAD_REQUEST", message: "Module URL missing." } };
      }

      if (module.url?.startsWith("/")) {
        router.push(`${url.pathname}${url.search}${url.hash}`);
        return { ok: true, result: { opened: true } };
      }

      window.location.assign(url.toString());
      return { ok: true, result: { opened: true } };
    },
    [canOpenModule, moduleIndex, resolveModuleUrl, router],
  );

  const handleRequest = useCallback(
    async (event: MessageEvent, request: PortalRpcRequest) => {
      const module = moduleIndex.get(request.moduleId);
      if (!module) {
        return createPortalRpcResponse(request, false, undefined, {
          code: "UNKNOWN_MODULE",
          message: "Unknown module.",
        });
      }

      const allowedOrigins = module.allowedOrigins ?? [window.location.origin];
      if (!allowedOrigins.includes(event.origin)) {
        return null;
      }

      const expectedWindow = iframeRegistry.current.get(request.moduleId);
      if (expectedWindow && event.source !== expectedWindow) {
        return null;
      }

      const allowedActions = module.capabilities?.portalRpc?.allowedActions ?? [];
      if (!allowedActions.includes(request.action)) {
        return createPortalRpcResponse(request, false, undefined, {
          code: "NOT_ALLOWED",
          message: "Action not allowed.",
        });
      }

      if (request.action === "auth.getToken") {
        if (!authToken) {
          return createPortalRpcResponse(request, false, undefined, {
            code: "NOT_AUTHENTICATED",
            message: "Sign in required.",
          });
        }
        return createPortalRpcResponse(request, true, {
          accessToken: authToken,
          expiresAt: sessionExpiresAt ?? null,
        });
      }

      if (request.action === "profile.refresh") {
        emitProfileRefresh();
        return createPortalRpcResponse(request, true, { queued: true });
      }

      if (request.action === "ui.toast") {
        const payload = request.payload as { kind?: string; message?: string } | undefined;
        if (payload?.message) {
          const kind =
            payload.kind === "success" || payload.kind === "error" ? payload.kind : "info";
          emitPortalToast({ kind, message: payload.message });
        }
        return createPortalRpcResponse(request, true, { shown: true });
      }

      if (request.action === "module.open") {
        const result = handleModuleOpen(request.payload as PortalRpcOpenPayload);
        if (!result.ok) {
          return createPortalRpcResponse(request, false, undefined, result.error);
        }
        return createPortalRpcResponse(request, true, result.result);
      }

      return createPortalRpcResponse(request, false, undefined, {
        code: "UNSUPPORTED_ACTION",
        message: "Unsupported action.",
      });
    },
    [authToken, emitProfileRefresh, handleModuleOpen, moduleIndex, sessionExpiresAt],
  );

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (!isPortalRpcRequest(event.data)) return;
      const request = event.data;
      const response = await handleRequest(event, request);
      if (!response) return;
      if (event.source && "postMessage" in event.source) {
        (event.source as Window).postMessage(response, event.origin);
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [handleRequest]);

  return null;
}

export function registerPortalIframe(moduleId: string, win: Window | null) {
  const registry = (window as Window & {
    __portalRegisterIframe?: (id: string, w: Window | null) => void;
  }).__portalRegisterIframe;
  if (registry) {
    registry(moduleId, win);
  }
}

export const portalOpenModuleEvent = OPEN_MODULE_EVENT;
