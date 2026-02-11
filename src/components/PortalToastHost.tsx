"use client";

import { useEffect, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

type ToastEventDetail = {
  kind: ToastKind;
  message: string;
};

const TOAST_EVENT = "portal-toast";

export function PortalToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeouts = useMemo(() => new Map<string, number>(), []);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      if (!detail?.message) return;
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, kind: detail.kind, message: detail.message }]);
      const timeoutId = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        timeouts.delete(id);
      }, 3500);
      timeouts.set(id, timeoutId);
    };
    window.addEventListener(TOAST_EVENT, handleToast as EventListener);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast as EventListener);
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, [timeouts]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-6 top-20 z-[60] flex w-[280px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 text-xs shadow-lg backdrop-blur ${
            toast.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : toast.kind === "error"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                : "border-sky-500/30 bg-sky-500/10 text-sky-200"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export function emitPortalToast(detail: ToastEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
}
