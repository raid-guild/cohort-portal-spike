"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

const AVATAR_EDITOR_FRAME = 280;
const AVATAR_UPLOAD_SIZE = 512;

type AvatarEditorModalProps = {
  open: boolean;
  user: User | null;
  profileExists: boolean;
  supabase: SupabaseClient<Database>;
  onClose: () => void;
  onSaved: (avatarUrl: string, version: number) => void;
  onError: (message: string) => void;
};

export function AvatarEditorModal({
  open,
  user,
  profileExists,
  supabase,
  onClose,
  onSaved,
  onError,
}: AvatarEditorModalProps) {
  const [saving, setSaving] = useState(false);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [draftImageSize, setDraftImageSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [draftImage, setDraftImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [statusMessage, setStatusMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const reset = useCallback(() => {
    setDraftFile(null);
    setDraftUrl(null);
    setDraftImageSize(null);
    setDraftImage(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setStatusMessage("");
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!draftFile) {
      setDraftUrl(null);
      setDraftImageSize(null);
      setDraftImage(null);
      return;
    }
    const url = URL.createObjectURL(draftFile);
    setDraftUrl(url);
    loadImageElement(url)
      .then((img) => {
        setDraftImage(img);
        setDraftImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      })
      .catch(() => {
        setDraftImageSize(null);
        setDraftImage(null);
        const errorMessage = "Unable to read selected image.";
        setStatusMessage(errorMessage);
        onError(errorMessage);
      });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [draftFile, onError]);

  const updateZoom = useCallback(
    (nextZoom: number) => {
      const clampedZoom = clamp(nextZoom, 1, 3);
      setZoom(clampedZoom);
      if (!draftImageSize) return;
      setPan((current) =>
        clampAvatarPan({
          imageSize: draftImageSize,
          frameSize: AVATAR_EDITOR_FRAME,
          zoom: clampedZoom,
          pan: current,
        }),
      );
    },
    [draftImageSize],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!draftImageSize) return;
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      updateZoom(zoom + delta);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [draftImageSize, updateZoom, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, AVATAR_EDITOR_FRAME, AVATAR_EDITOR_FRAME);
    ctx.fillStyle = "hsl(var(--muted))";
    ctx.fillRect(0, 0, AVATAR_EDITOR_FRAME, AVATAR_EDITOR_FRAME);

    if (!draftImage || !draftImageSize) {
      return;
    }

    const placement = computeAvatarPlacement({
      imageSize: draftImageSize,
      frameSize: AVATAR_EDITOR_FRAME,
      zoom,
      panX: pan.x,
      panY: pan.y,
    });
    ctx.drawImage(
      draftImage,
      placement.left,
      placement.top,
      placement.renderWidth,
      placement.renderHeight,
    );
  }, [draftImage, draftImageSize, pan.x, pan.y, zoom]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draftImageSize) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !draftImageSize) return;
    const nextPan = {
      x: drag.startPanX + (event.clientX - drag.startX),
      y: drag.startPanY + (event.clientY - drag.startY),
    };
    setPan(
      clampAvatarPan({
        imageSize: draftImageSize,
        frameSize: AVATAR_EDITOR_FRAME,
        zoom,
        pan: nextPan,
      }),
    );
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (!user) {
      const errorMessage = "Please sign in first.";
      setStatusMessage(errorMessage);
      onError(errorMessage);
      return;
    }
    if (!draftFile || !draftImageSize) {
      const errorMessage = "Choose an avatar image to upload.";
      setStatusMessage(errorMessage);
      onError(errorMessage);
      return;
    }

    setSaving(true);
    setStatusMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const errorMessage = "Please sign in again.";
        setStatusMessage(errorMessage);
        onError(errorMessage);
        return;
      }

      const croppedAvatarBlob = await createCroppedAvatarBlob({
        file: draftFile,
        imageSize: draftImageSize,
        frameSize: AVATAR_UPLOAD_SIZE,
        zoom,
        panX: pan.x * (AVATAR_UPLOAD_SIZE / AVATAR_EDITOR_FRAME),
        panY: pan.y * (AVATAR_UPLOAD_SIZE / AVATAR_EDITOR_FRAME),
      });

      const formData = new FormData();
      formData.append(
        "file",
        new File([croppedAvatarBlob], `avatar-${Date.now()}.jpg`, {
          type: "image/jpeg",
        }),
      );

      const res = await fetch("/api/avatars", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        const errorMessage = json.error || "Avatar upload failed.";
        setStatusMessage(errorMessage);
        onError(errorMessage);
        return;
      }

      const publicUrl = json.url as string;
      if (profileExists) {
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("user_id", user.id);
        if (error) {
          setStatusMessage(error.message);
          onError(error.message);
          return;
        }
      }

      const version = Date.now();
      window.localStorage.setItem("profile-updated", new Date(version).toISOString());
      window.postMessage({ type: "profile-updated" }, window.location.origin);
      onSaved(publicUrl, version);
      onClose();
    } catch {
      const errorMessage = "Avatar processing failed. Please try another image.";
      setStatusMessage(errorMessage);
      onError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Edit avatar</h2>
            <p className="text-xs text-muted-foreground">
              Click the canvas to pick an image. Drag to pan and zoom.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => {
              setDraftFile(event.target.files?.[0] ?? null);
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="sr-only"
          />
          {draftUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              Change image
            </button>
          ) : null}

          <div className="space-y-3">
            <div className="text-sm font-semibold">Crop canvas</div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Drag to pan.</span>
              <span>Scroll or slider to zoom.</span>
              <span>Zoom: {zoom.toFixed(2)}x</span>
            </div>
            <div className="flex items-start gap-4">
              <canvas
                ref={canvasRef}
                width={AVATAR_EDITOR_FRAME}
                height={AVATAR_EDITOR_FRAME}
                className={`touch-none rounded-xl border border-border bg-muted ${
                  draftUrl ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
                onClick={() => {
                  if (!draftUrl) {
                    fileInputRef.current?.click();
                  }
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
              <div className="flex h-[280px] items-center">
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => updateZoom(Number(event.target.value))}
                  className="w-[280px] -rotate-90"
                  disabled={!draftUrl}
                  aria-label="Zoom avatar"
                />
              </div>
            </div>
            {!draftUrl ? (
              <div className="text-xs text-muted-foreground">Click the canvas to select an image.</div>
            ) : null}
            {statusMessage ? <div className="text-xs text-muted-foreground">{statusMessage}</div> : null}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg border border-border bg-primary px-3 py-2 text-xs text-background hover:opacity-90 disabled:opacity-60"
            disabled={saving || !draftFile}
          >
            {saving ? "Saving..." : "Save avatar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeAvatarPlacement({
  imageSize,
  frameSize,
  zoom,
  panX,
  panY,
}: {
  imageSize: { width: number; height: number };
  frameSize: number;
  zoom: number;
  panX: number;
  panY: number;
}) {
  const safeZoom = clamp(zoom, 1, 3);
  const baseScale = Math.max(frameSize / imageSize.width, frameSize / imageSize.height);
  const renderScale = baseScale * safeZoom;
  const renderWidth = imageSize.width * renderScale;
  const renderHeight = imageSize.height * renderScale;
  const centeredLeft = (frameSize - renderWidth) / 2;
  const centeredTop = (frameSize - renderHeight) / 2;
  const maxLeft = 0;
  const minLeft = frameSize - renderWidth;
  const maxTop = 0;
  const minTop = frameSize - renderHeight;
  const left = clamp(centeredLeft + panX, minLeft, maxLeft);
  const top = clamp(centeredTop + panY, minTop, maxTop);
  return {
    renderScale,
    renderWidth,
    renderHeight,
    left,
    top,
    panX: left - centeredLeft,
    panY: top - centeredTop,
  };
}

function clampAvatarPan({
  imageSize,
  frameSize,
  zoom,
  pan,
}: {
  imageSize: { width: number; height: number };
  frameSize: number;
  zoom: number;
  pan: { x: number; y: number };
}) {
  const placement = computeAvatarPlacement({
    imageSize,
    frameSize,
    zoom,
    panX: pan.x,
    panY: pan.y,
  });
  return { x: placement.panX, y: placement.panY };
}

async function loadImageElement(imageUrl: string) {
  const img = document.createElement("img");
  img.decoding = "async";
  img.src = imageUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image failed to load."));
  });
  return img;
}

async function createCroppedAvatarBlob({
  file,
  imageSize,
  frameSize,
  zoom,
  panX,
  panY,
}: {
  file: File;
  imageSize: { width: number; height: number };
  frameSize: number;
  zoom: number;
  panX: number;
  panY: number;
}) {
  const objectUrl = URL.createObjectURL(file);
  const img = document.createElement("img");
  img.decoding = "async";
  img.src = objectUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image failed to load."));
  });

  const placement = computeAvatarPlacement({
    imageSize,
    frameSize,
    zoom,
    panX,
    panY,
  });
  const sourceX = (0 - placement.left) / placement.renderScale;
  const sourceY = (0 - placement.top) / placement.renderScale;
  const sourceSize = frameSize / placement.renderScale;

  const canvas = document.createElement("canvas");
  canvas.width = frameSize;
  canvas.height = frameSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Canvas unavailable.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    frameSize,
    frameSize,
  );
  URL.revokeObjectURL(objectUrl);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", 0.92);
  });
  if (!blob) {
    throw new Error("Unable to create avatar image.");
  }
  return blob;
}
