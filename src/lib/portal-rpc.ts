export const PORTAL_RPC_PROTOCOL = "rg-portal-rpc" as const;
export const PORTAL_RPC_VERSION = 1 as const;

export type PortalRpcRequest = {
  protocol: typeof PORTAL_RPC_PROTOCOL;
  version: typeof PORTAL_RPC_VERSION;
  type: "request";
  id: string;
  moduleId: string;
  action: string;
  payload?: unknown;
};

export type PortalRpcError = {
  code: string;
  message: string;
};

export type PortalRpcResponse = {
  protocol: typeof PORTAL_RPC_PROTOCOL;
  version: typeof PORTAL_RPC_VERSION;
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: PortalRpcError;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isPortalRpcRequest(value: unknown): value is PortalRpcRequest {
  if (!isRecord(value)) return false;
  return (
    value.protocol === PORTAL_RPC_PROTOCOL &&
    value.version === PORTAL_RPC_VERSION &&
    value.type === "request" &&
    typeof value.id === "string" &&
    typeof value.moduleId === "string" &&
    typeof value.action === "string"
  );
}

export function isPortalRpcResponse(value: unknown): value is PortalRpcResponse {
  if (!isRecord(value)) return false;
  return (
    value.protocol === PORTAL_RPC_PROTOCOL &&
    value.version === PORTAL_RPC_VERSION &&
    value.type === "response" &&
    typeof value.id === "string" &&
    typeof value.ok === "boolean"
  );
}

export function createPortalRpcResponse(
  request: PortalRpcRequest,
  ok: boolean,
  result?: unknown,
  error?: PortalRpcError,
): PortalRpcResponse {
  return {
    protocol: PORTAL_RPC_PROTOCOL,
    version: PORTAL_RPC_VERSION,
    type: "response",
    id: request.id,
    ok,
    result,
    error,
  };
}
