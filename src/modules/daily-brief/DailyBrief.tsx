"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type ViewerPayload = {
  handle?: string | null;
  displayName?: string | null;
};

export function DailyBrief() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [briefReady, setBriefReady] = useState(false);
  const [message, setMessage] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [markdownUrl, setMarkdownUrl] = useState<string | null>(null);
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownError, setMarkdownError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "portal-auth-token") {
        setAuthToken(event.data.token);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadViewer = async () => {
      if (!authToken) {
        setViewer(null);
        setMessage("Sign in to unlock your daily brief.");
        setBriefReady(false);
        setAudioUrl(null);
        setMarkdownUrl(null);
        return;
      }
      setMessage("");
      const res = await fetch("/api/modules/daily-brief", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        if (!cancelled) {
          setViewer(null);
          setMessage("We couldn't load your daily brief yet.");
          setBriefReady(false);
          setAudioUrl(null);
          setMarkdownUrl(null);
        }
        return;
      }
      const payload = (await res.json()) as ViewerPayload;
      if (!cancelled) {
        setViewer(payload);
        setBriefReady(false);
        setAudioUrl(null);
        setMarkdownUrl(null);
        setShowNewsletter(false);
        setMarkdownContent(null);
        setMarkdownError(null);
      }
    };
    loadViewer();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const handle = viewer?.handle ?? "adventurer";
  const canLoad = Boolean(viewer?.handle) && !message;
  const isPlayable = Boolean(audioUrl);
  const hasMarkdown = Boolean(markdownUrl);

  const handlePlay = async () => {
    if (!authToken) {
      setMessage("Sign in to unlock your daily brief.");
      return;
    }
    setLoading(true);
    setBriefReady(false);
    setMessage("");
    setAudioUrl(null);
    setMarkdownUrl(null);
    setShowNewsletter(false);
    setMarkdownContent(null);
    setMarkdownError(null);
    try {
      const res = await fetch("/api/modules/daily-brief/brief", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        setMessage("We couldn't load your daily brief yet.");
        setLoading(false);
        return;
      }
      const payload = (await res.json()) as {
        audioUrl?: string | null;
        markdownUrl?: string | null;
      };
      setAudioUrl(payload.audioUrl ?? null);
      setMarkdownUrl(payload.markdownUrl ?? null);
    } catch {
      setMessage("We couldn't load your daily brief yet.");
      setLoading(false);
      return;
    }
    setLoading(false);
    setBriefReady(true);
  };

  useEffect(() => {
    if (!briefReady || !audioRef.current) {
      return;
    }
    audioRef.current.play().catch(() => {
      // Autoplay can be blocked; user can press play manually.
    });
  }, [briefReady, audioUrl]);

  const handleToggleNewsletter = async () => {
    if (!markdownUrl) return;
    const next = !showNewsletter;
    setShowNewsletter(next);
    if (!next || markdownContent || markdownLoading) {
      return;
    }
    setMarkdownLoading(true);
    setMarkdownError(null);
    try {
      const res = await fetch(markdownUrl);
      if (!res.ok) {
        throw new Error(`Failed to load (${res.status})`);
      }
      const text = await res.text();
      setMarkdownContent(text);
    } catch (error) {
      setMarkdownError(
        error instanceof Error ? error.message : "Failed to load newsletter.",
      );
    } finally {
      setMarkdownLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Daily Brief</h1>
        <p className="text-sm text-muted-foreground">
          Your personal update with the latest community news.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {!message && loading ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-3 text-lg">
              <span
                className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent"
                aria-hidden="true"
              />
              <p>Preparing your daily brief...</p>
            </div>
            <p className="text-xs">Thanks for your patience!</p>
          </div>
        ) : null}
        {!message && !loading ? (
          <div className="space-y-4">
            <div className="space-y-2 text-center">
              <p className="text-2xl font-semibold">
                Welcome back, <span className="text-primary">@{handle}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {currentDate || "Loading date..."}
              </p>
            </div>
            {canLoad && !briefReady ? (
              <button
                type="button"
                onClick={handlePlay}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                Play daily brief
              </button>
            ) : null}
            {hasMarkdown ? (
              <button
                type="button"
                onClick={handleToggleNewsletter}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                {showNewsletter ? "Collapse Daily Newsletter" : "Expand Daily Newsletter"}
              </button>
            ) : null}
            {briefReady ? (
              <div>
                <p className="text-xs text-muted-foreground">Listen to today's brief.</p>
                <audio
                  ref={audioRef}
                  className="mt-2 w-full"
                  controls
                  preload="none"
                >
                  <source
                    src={audioUrl ?? "/audio/deke-update-demo.mp3"}
                    type="audio/mpeg"
                  />
                  Your browser does not support the audio element.
                </audio>
                {!isPlayable ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Using demo audio while the brief renders.
                  </p>
                ) : null}
              </div>
            ) : null}
            {showNewsletter ? (
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Daily Newsletter</p>
                  <button
                    type="button"
                    onClick={() => setShowNewsletter(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                {markdownLoading ? (
                  <p className="text-xs text-muted-foreground">Loading newsletter...</p>
                ) : null}
                {markdownError ? (
                  <p className="text-xs text-red-500">{markdownError}</p>
                ) : null}
                {markdownContent ? (
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs text-foreground">
                    {markdownContent}
                  </pre>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              Record my check in
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
