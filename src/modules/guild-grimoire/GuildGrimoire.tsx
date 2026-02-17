"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import type {
  GuildGrimoireContentType,
  GuildGrimoireNote,
  GuildGrimoireTag,
  GuildGrimoireVisibility,
} from "@/modules/guild-grimoire/types";

const MAX_TEXT = 256;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_AUDIO_MIMES = new Set(["audio/webm", "audio/mp4", "audio/aac", "audio/mpeg"]);

const ALLOWED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_AUDIO_EXTS = new Set(["webm", "mp4", "m4a", "aac", "mp3"]);
const AUDIO_RECORDING_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function extensionFromFilename(filename: string) {
  const dotIdx = filename.lastIndexOf(".");
  // No extension (or dot-file like ".env")
  if (dotIdx < 1 || dotIdx === filename.length - 1) return null;
  return filename.slice(dotIdx + 1).toLowerCase() || null;
}

function truncateMiddle(value: string, max = 32) {
  if (value.length <= max) return value;
  const head = value.slice(0, Math.max(8, Math.floor(max / 2) - 2));
  const tail = value.slice(-Math.max(8, Math.floor(max / 2) - 2));
  return `${head}…${tail}`;
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.startsWith("audio/webm")) return "webm";
  if (mimeType.startsWith("audio/mp4")) return "mp4";
  if (mimeType.startsWith("audio/aac")) return "aac";
  if (mimeType.startsWith("audio/mpeg")) return "mp3";
  return "webm";
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function GuildGrimoire() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);

  const [mode, setMode] = useState<GuildGrimoireContentType>("text");
  const [visibility, setVisibility] = useState<GuildGrimoireVisibility>("shared");

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const audioPreviewUrlRef = useRef<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordingSupported, setRecordingSupported] = useState(true);

  const [tags, setTags] = useState<GuildGrimoireTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [newTagLabel, setNewTagLabel] = useState("");

  const [feed, setFeed] = useState<GuildGrimoireNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterMine, setFilterMine] = useState(false);
  const [filterContentType, setFilterContentType] = useState<
    GuildGrimoireContentType | "all"
  >("all");
  const [filterTagId, setFilterTagId] = useState<string>("");
  const [filterVisibility, setFilterVisibility] = useState<
    GuildGrimoireVisibility | "all"
  >("all");

  type FeedFilters = {
    mine: boolean;
    contentType: GuildGrimoireContentType | "all";
    tagId: string;
    visibility: GuildGrimoireVisibility | "all";
  };

  const [appliedFilters, setAppliedFilters] = useState<FeedFilters>({
    mine: false,
    contentType: "all",
    tagId: "",
    visibility: "all",
  });

  const loadTags = useCallback(async (accessToken: string) => {
    const res = await fetch("/api/modules/guild-grimoire/tags", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as { tags?: GuildGrimoireTag[]; error?: string };
    if (!res.ok) {
      throw new Error(json.error || "Failed to load tags.");
    }
    setTags(json.tags ?? []);
  }, []);

  const loadFeed = useCallback(async (accessToken: string, filters: FeedFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.mine) params.set("mine", "true");
      if (filters.contentType !== "all") params.set("contentType", filters.contentType);
      if (filters.tagId) params.set("tag", filters.tagId);
      if (filters.visibility !== "all") params.set("visibility", filters.visibility);

      const res = await fetch(`/api/modules/guild-grimoire/feed?${params.toString()}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const json = (await res.json()) as { notes?: GuildGrimoireNote[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load feed.");
      }
      setFeed(json.notes ?? []);
    } catch (err) {
      setFeed([]);
      setError(err instanceof Error ? err.message : "Failed to load feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You must be signed in to use Guild Grimoire.");
        setFeed([]);
        setTags([]);
        return;
      }
      await Promise.all([loadTags(token), loadFeed(token, appliedFilters)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load module.");
    } finally {
      setLoading(false);
    }
  }, [supabase, loadTags, loadFeed, appliedFilters]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRecordingSupported(
      typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined" &&
        typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current;
      if (startedAt) {
        setRecordingDurationMs(Date.now() - startedAt);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    audioPreviewUrlRef.current = audioPreviewUrl;
  }, [audioPreviewUrl]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrlRef.current) {
        URL.revokeObjectURL(audioPreviewUrlRef.current);
        audioPreviewUrlRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const stopStreamTracks = useCallback(() => {
    if (!mediaStreamRef.current) return;
    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const clearAudioRecording = useCallback(() => {
    if (audioPreviewUrlRef.current) {
      URL.revokeObjectURL(audioPreviewUrlRef.current);
      audioPreviewUrlRef.current = null;
    }
    setAudioPreviewUrl(null);
    setFile(null);
    recordingChunksRef.current = [];
    recordingStartedAtRef.current = null;
    setRecordingDurationMs(0);
  }, []);

  useEffect(() => {
    // keep composer fields consistent across modes
    setError(null);
    setText("");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    stopStreamTracks();
    clearAudioRecording();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [mode, clearAudioRecording, stopStreamTracks]);

  const startRecording = async () => {
    setError(null);
    if (!recordingSupported) {
      setError("Audio recording is not supported in this browser.");
      return;
    }
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMime = AUDIO_RECORDING_MIME_CANDIDATES.find((candidate) =>
        MediaRecorder.isTypeSupported(candidate),
      );
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || preferredMime || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        recordingChunksRef.current = [];
        stopStreamTracks();
        setIsRecording(false);

        if (!blob.size) {
          setError("No audio captured. Try recording again.");
          clearAudioRecording();
          return;
        }
        if (blob.size > MAX_AUDIO_BYTES) {
          setError("Audio too large (max 3MB). Record a shorter clip.");
          clearAudioRecording();
          return;
        }

        const ext = extensionFromMimeType(mimeType);
        const recordedFile = new File([blob], `guild-grimoire-${Date.now()}.${ext}`, {
          type: mimeType,
        });

        if (audioPreviewUrlRef.current) {
          URL.revokeObjectURL(audioPreviewUrlRef.current);
          audioPreviewUrlRef.current = null;
        }
        const nextPreviewUrl = URL.createObjectURL(blob);
        audioPreviewUrlRef.current = nextPreviewUrl;
        setAudioPreviewUrl(nextPreviewUrl);
        setFile(recordedFile);
        recordingStartedAtRef.current = null;
      };

      clearAudioRecording();
      recorder.start();
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      setRecordingDurationMs(0);
      setIsRecording(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to access microphone. Check browser permissions.",
      );
      setIsRecording(false);
      stopStreamTracks();
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
  };

  const createTag = async () => {
    setError(null);
    const label = newTagLabel.trim();
    if (!label) return;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You must be signed in to create tags.");
        return;
      }

      const res = await fetch("/api/modules/guild-grimoire/tags", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label }),
      });
      const json = (await res.json()) as { tag?: GuildGrimoireTag; error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to create tag.");
        return;
      }

      setNewTagLabel("");
      await loadTags(token);
      if (json.tag?.id) {
        setSelectedTagIds((prev) => new Set([...prev, json.tag!.id]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag.");
    }
  };

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("You must be signed in to post.");
      }

      if (mode === "text") {
        const trimmed = text.trim();
        if (!trimmed) throw new Error("Note text is required.");
        if (trimmed.length > MAX_TEXT) {
          throw new Error(`Text must be <= ${MAX_TEXT} characters.`);
        }

        const res = await fetch("/api/modules/guild-grimoire/notes", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content_type: "text",
            text_content: trimmed,
            visibility,
            tag_ids: Array.from(selectedTagIds),
          }),
        });

        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to post note.");
      } else {
        if (!file) {
          throw new Error(mode === "audio" ? "Please record audio first." : "Please select a file.");
        }

        if (mode === "image") {
          if (file.size > MAX_IMAGE_BYTES) {
            throw new Error("Image too large (max 5MB). ");
          }

          if (file.type) {
            if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
              throw new Error(`Unsupported image type: ${file.type}`);
            }
          } else {
            const ext = extensionFromFilename(file.name);
            if (!ext || !ALLOWED_IMAGE_EXTS.has(ext)) {
              throw new Error(`Unsupported image type: ${ext ? `.${ext}` : "unknown"}`);
            }
          }
        }

        if (mode === "audio") {
          if (file.size > MAX_AUDIO_BYTES) {
            throw new Error("Audio too large (max 3MB). ");
          }

          if (file.type) {
            if (!ALLOWED_AUDIO_MIMES.has(file.type)) {
              throw new Error(`Unsupported audio type: ${file.type}`);
            }
          } else {
            const ext = extensionFromFilename(file.name);
            if (!ext || !ALLOWED_AUDIO_EXTS.has(ext)) {
              throw new Error(`Unsupported audio type: ${ext ? `.${ext}` : "unknown"}`);
            }
          }
        }

        const form = new FormData();
        form.set("content_type", mode);
        form.set("visibility", visibility);
        form.set("file", file);
        for (const id of selectedTagIds) {
          form.append("tag_ids", id);
        }

        const res = await fetch("/api/modules/guild-grimoire/notes", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to post note.");
      }

      setText("");
      clearAudioRecording();
      if (fileInputRef.current) fileInputRef.current.value = "";

      await Promise.all([loadFeed(token, appliedFilters), loadTags(token)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setSaving(false);
    }
  };

  const softDelete = async (noteId: string) => {
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You must be signed in.");
        return;
      }

      const res = await fetch(`/api/modules/guild-grimoire/notes/${noteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to delete note.");
        return;
      }

      await loadFeed(token, appliedFilters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Quick capture</div>
        <div className="mt-3 grid gap-4">
          <div className="flex flex-wrap gap-2">
            {(["text", "image", "audio"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMode(t)}
                className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm ${
                  mode === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {t === "text" ? "Note" : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Visibility</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as GuildGrimoireVisibility)}
              className="h-10 rounded-lg border border-border bg-background px-3"
            >
              <option value="shared">shared</option>
              <option value="public">public</option>
              <option value="cohort">cohort</option>
              <option value="private">private</option>
            </select>
          </label>

          {mode === "text" ? (
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Text (max {MAX_TEXT})</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_TEXT}
                className="min-h-24 rounded-lg border border-border bg-background p-3"
                placeholder="What’s happening?"
              />
              <div className="text-xs text-muted-foreground">
                {text.length}/{MAX_TEXT}
              </div>
            </label>
          ) : mode === "image" ? (
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Image (camera or upload)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="text-xs text-muted-foreground">
                  Selected: {truncateMiddle(file.name)} ({Math.round(file.size / 1024)} KB)
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                On mobile, this will prompt for camera capture when supported.
              </div>
            </label>
          ) : (
            <div className="grid gap-2 text-sm">
              <div className="text-xs text-muted-foreground">
                Audio recording (max 3MB)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isRecording || saving || !recordingSupported}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-60"
                >
                  Start recording
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={!isRecording}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-60"
                >
                  Stop
                </button>
                <button
                  type="button"
                  onClick={clearAudioRecording}
                  disabled={isRecording || !file}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
              {!recordingSupported ? (
                <div className="text-xs text-red-500">
                  This browser does not support microphone recording.
                </div>
              ) : null}
              {isRecording ? (
                <div className="text-xs text-muted-foreground">
                  Recording... {formatDuration(recordingDurationMs)}
                </div>
              ) : null}
              {file ? (
                <div className="text-xs text-muted-foreground">
                  Recorded: {truncateMiddle(file.name)} ({Math.round(file.size / 1024)} KB)
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No recording captured yet.</div>
              )}
              {audioPreviewUrl ? (
                <audio controls src={audioPreviewUrl} className="w-full" />
              ) : null}
              <div className="text-xs text-muted-foreground">
                Browser will ask for microphone permission the first time.
              </div>
              <span className="text-xs text-muted-foreground">
                Audio file upload is disabled for this module.
              </span>
            </div>
          )}

          <div className="grid gap-2">
            <div className="text-xs text-muted-foreground">Tags</div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setSelectedTagIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(tag.id)) next.delete(tag.id);
                        else next.add(tag.id);
                        return next;
                      })
                    }
                    className={`inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <input
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                placeholder="Create a new tag…"
              />
              <button
                type="button"
                onClick={createTag}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Posting..." : "Post"}
            </button>
            <button
              type="button"
              onClick={bootstrap}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted"
            >
              Refresh
            </button>
          </div>

          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Shared feed</div>
            <div className="text-xs text-muted-foreground">
              Filters apply to what you fetch from the API.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Mine</span>
              <select
                value={filterMine ? "mine" : "all"}
                onChange={(e) => setFilterMine(e.target.value === "mine")}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="all">all</option>
                <option value="mine">mine</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Type</span>
              <select
                value={filterContentType}
                onChange={(e) =>
                  setFilterContentType(e.target.value as GuildGrimoireContentType | "all")
                }
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="all">all</option>
                <option value="text">text</option>
                <option value="image">image</option>
                <option value="audio">audio</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Visibility</span>
              <select
                value={filterVisibility}
                onChange={(e) =>
                  setFilterVisibility(e.target.value as GuildGrimoireVisibility | "all")
                }
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="all">all</option>
                <option value="shared">shared</option>
                <option value="public">public</option>
                <option value="cohort">cohort</option>
                <option value="private">private</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Tag</span>
              <select
                value={filterTagId}
                onChange={(e) => setFilterTagId(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="">all</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={async () => {
                try {
                  const { data } = await supabase.auth.getSession();
                  const token = data.session?.access_token;
                  if (!token) {
                    setError("You must be signed in.");
                    return;
                  }
                  const nextFilters: FeedFilters = {
                    mine: filterMine,
                    contentType: filterContentType,
                    tagId: filterTagId,
                    visibility: filterVisibility,
                  };
                  setAppliedFilters(nextFilters);
                  await loadFeed(token, nextFilters);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to apply filters.");
                }
              }}
              className="col-span-2 inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-muted sm:col-span-1"
            >
              Apply
            </button>
          </div>
        </div>

        {loading && !feed.length ? (
          <div className="mt-3 text-sm text-muted-foreground">Loading feed...</div>
        ) : null}

        {!loading && !feed.length ? (
          <div className="mt-3 text-sm text-muted-foreground">No notes yet.</div>
        ) : null}

        {feed.length ? (
          <div className="mt-4 grid gap-3">
            {feed.map((note) => (
              <div key={note.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">{note.content_type}</span>
                      {" · "}
                      <span>{note.visibility}</span>
                      {" · "}
                      <span>{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                    <div>User: {truncateMiddle(note.user_id, 24)}</div>
                    {note.tags?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {note.tags.map((t) => (
                          <span
                            key={t.id}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px]"
                          >
                            {t.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {appliedFilters.mine ? (
                    <button
                      type="button"
                      onClick={() => softDelete(note.id)}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-3 text-xs hover:bg-muted"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>

                {note.content_type === "text" ? (
                  <div className="mt-2 whitespace-pre-wrap text-sm">{note.text_content}</div>
                ) : null}

                {note.content_type === "image" && note.image_url ? (
                  <div className="mt-2 overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={note.image_url} alt="Guild grimoire note" className="w-full" />
                  </div>
                ) : null}

                {note.content_type === "audio" && note.audio_url ? (
                  <div className="mt-2">
                    <audio controls src={note.audio_url} className="w-full" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
