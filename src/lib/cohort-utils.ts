type MaybeError = {
  code?: string;
  message?: string;
};

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function validateSlugInput(value: string) {
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    return "Slug may only contain letters, numbers, and hyphens.";
  }
  const normalized = toSlug(value);
  if (!normalized) {
    return "Slug must include at least one letter or number.";
  }
  return null;
}

export function isDuplicateSlugError(error?: MaybeError | null) {
  if (!error) return false;
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("duplicate") === true ||
    error.message?.includes("cohorts_slug_unique_idx") === true
  );
}

export function toSafeHttpUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!HTTP_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeYouTubeId(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return YOUTUBE_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function getYouTubeVideoId(url?: string | null) {
  const safeUrl = toSafeHttpUrl(url);
  if (!safeUrl) return null;

  try {
    const parsed = new URL(safeUrl);
    const host = parsed.hostname.replace("www.", "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return sanitizeYouTubeId(id);
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return sanitizeYouTubeId(fromQuery);

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed") {
        return sanitizeYouTubeId(parts[1]);
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function truncateAtWordBoundary(value: string, maxLength: number) {
  const text = value.trim();
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const output = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return `${output.trimEnd()}...`;
}
