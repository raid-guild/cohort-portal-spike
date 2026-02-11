import {
  PORTAL_RPC_PROTOCOL,
  PORTAL_RPC_VERSION,
  isPortalRpcResponse,
  type PortalRpcError,
  type PortalRpcRequest,
  type PortalRpcResponse,
} from "@/lib/portal-rpc";

type PortalRpcClientOptions = {
  targetOrigin?: string;
  timeoutMs?: number;
};

// PortalRpcError imported from @/lib/portal-rpc

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: PortalRpcError) => void;
  timeoutId: number;
};

function getDefaultTargetOrigin(): string | null {
  if (typeof window === "undefined") return null;

  if (typeof document !== "undefined" && document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      // ignore
    }
  }

  // Safe fallback (never wildcard): this will only work when the parent is same-origin.
  return window.location.origin;
}

export function createPortalRpcClient(moduleId: string, options?: PortalRpcClientOptions) {
  const pending = new Map<string, PendingRequest>();
  const targetOrigin = options?.targetOrigin ?? getDefaultTargetOrigin();
  const timeoutMs = options?.timeoutMs ?? 6000;

  if (!targetOrigin) {
    throw new Error(
      "Unable to determine portal RPC targetOrigin. Pass { targetOrigin } explicitly (e.g. new URL(document.referrer).origin).",
    );
  }

  const handleMessage = (event: MessageEvent) => {
    if (!isPortalRpcResponse(event.data)) return;
    if (targetOrigin !== "*" && event.origin !== targetOrigin) return;
    const response = event.data as PortalRpcResponse;
    const entry = pending.get(response.id);
    if (!entry) return;
    window.clearTimeout(entry.timeoutId);
    pending.delete(response.id);
    if (response.ok) {
      entry.resolve(response.result);
    } else {
      entry.reject(response.error ?? { code: "UNKNOWN_ERROR", message: "Request failed." });
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", handleMessage);
  }

  const call = async (action: string, payload?: unknown) => {
    if (typeof window === "undefined") {
      throw new Error("portalRpc must run in a browser.");
    }

    const id = crypto.randomUUID();
    const request: PortalRpcRequest = {
      protocol: PORTAL_RPC_PROTOCOL,
      version: PORTAL_RPC_VERSION,
      type: "request",
      id,
      moduleId,
      action,
      payload,
    };

    const promise = new Promise<unknown>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pending.delete(id);
        reject({ code: "TIMEOUT", message: "Portal RPC timed out." } satisfies PortalRpcError);
      }, timeoutMs);
      pending.set(id, { resolve, reject: reject as PendingRequest["reject"], timeoutId });
    });

    window.parent.postMessage(request, targetOrigin);
    return promise;
  };

  const dispose = () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("message", handleMessage);
    }
    for (const [id, entry] of pending.entries()) {
      window.clearTimeout(entry.timeoutId);
      entry.reject({ code: "DISPOSED", message: "Portal RPC client disposed." });
      pending.delete(id);
    }
  };

  return { call, dispose };
}

export function emitLocalProfileRefresh() {
  if (typeof window === "undefined") return;
  const stamp = new Date().toISOString();
  window.localStorage.setItem("profile-updated", stamp);
  window.postMessage({ type: "profile-updated" }, window.location.origin);
}
