import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";
import { NextRequest } from "next/server";
import { asString, canAuthor, jsonError, requireViewer } from "@/app/api/modules/dao-blog/lib";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 3;

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer(request);
    if ("error" in viewer) {
      return jsonError(viewer.error, viewer.status);
    }

    if (!canAuthor(viewer)) {
      return jsonError("Active dao-member entitlement required.", 403);
    }

    const body = (await request.json().catch(() => null)) as
      | {
          url?: unknown;
        }
      | null;
    const sourceUrl = asString(body?.url);
    if (!sourceUrl) {
      return jsonError("url is required.");
    }

    const parsed = parseImportUrl(sourceUrl);
    if (!parsed.ok) {
      return jsonError(parsed.error);
    }

    const { finalUrl, response } = await fetchAllowedHtmlWithRedirects(parsed.url);
    const html = await readHtmlResponse(response);

    const pageTitle = extractTitle(html);
    const mainHtml = extractMainContent(html);
    const markdown = htmlToMarkdown(mainHtml, finalUrl).trim();
    const summary = extractSummary(html, mainHtml, markdown);
    const headerImageUrl = extractHeaderImageUrl(html, mainHtml, finalUrl);

    if (!pageTitle) {
      return jsonError("Unable to extract title from source page.", 422);
    }
    if (!markdown) {
      return jsonError("Unable to extract article body from source page.", 422);
    }

    return Response.json({
      imported: {
        source_url: finalUrl,
        title: pageTitle.slice(0, 160),
        summary: summary.slice(0, 280),
        body_md: markdown.slice(0, 120000),
        header_image_url: headerImageUrl,
      },
    });
  } catch (err) {
    console.error("[dao-blog] import error:", err);
    return jsonError(err instanceof Error ? err.message : "Failed to import content.", 500);
  }
}

function parseImportUrl(value: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "Only https URLs are allowed." };
  }
  if (!isAllowedHost(url.hostname)) {
    return { ok: false, error: "Only .eth.link and .eth.limo URLs are supported." };
  }
  return { ok: true, url };
}

function isAllowedHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "eth.link" ||
    normalized.endsWith(".eth.link") ||
    normalized === "eth.limo" ||
    normalized.endsWith(".eth.limo")
  );
}

async function fetchAllowedHtmlWithRedirects(url: URL) {
  let current = url;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const pinnedAddress = await resolvePublicHostname(current.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const dispatcher = new Agent({
      connect: {
        lookup(hostname, _options, callback) {
          if (hostname !== current.hostname) {
            callback(new Error("Unexpected hostname lookup during fetch."));
            return;
          }
          callback(null, pinnedAddress, isIP(pinnedAddress));
        },
        servername: current.hostname,
      },
    });

    const response = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      dispatcher,
      headers: {
        "user-agent": "RaidGuildPortalDaoBlogImporter/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    }).finally(async () => {
      clearTimeout(timeout);
      await dispatcher.close();
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect response missing location header.");
      }
      const next = new URL(location, current);
      const parsed = parseImportUrl(next.toString());
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      current = parsed.url;
      continue;
    }

    if (response.status >= 400) {
      throw new Error(`Source returned ${response.status}.`);
    }

    return { finalUrl: current.toString(), response };
  }

  throw new Error("Too many redirects from source URL.");
}

async function readHtmlResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error("Source did not return HTML.");
  }

  return readResponseText(response, MAX_HTML_BYTES);
}

async function readResponseText(response: Response, maxBytes: number) {
  if (!response.body) {
    const fallbackText = await response.text();
    if (Buffer.byteLength(fallbackText, "utf8") > maxBytes) {
      throw new Error("Source HTML exceeded max size.");
    }
    return fallbackText;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > maxBytes) {
      throw new Error("Source HTML exceeded max size.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

async function resolvePublicHostname(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length) {
    throw new Error("Unable to resolve source hostname.");
  }
  let firstPublicAddress: string | null = null;
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error("Resolved source host is not publicly routable.");
    }
    if (!firstPublicAddress) {
      firstPublicAddress = record.address;
    }
  }
  if (!firstPublicAddress) {
    throw new Error("Unable to resolve source hostname.");
  }
  return firstPublicAddress;
}

function isPrivateIp(address: string) {
  const version = isIP(address);
  if (version === 6) {
    const normalized = address.toLowerCase();
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) {
      return isPrivateIp(mapped[1]);
    }
  }

  if (version === 4) {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10));
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)
    ) {
      return true;
    }
    const [a, b, c, d] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 192 && b === 88 && c === 99) return true;
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
    return false;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    return false;
  }
  return true;
}

function extractTitle(html: string) {
  return (
    extractMetaTagContent(html, "property", "og:title") ??
    extractMetaTagContent(html, "name", "twitter:title") ??
    extractTagText(html, "title") ??
    extractTagText(html, "h1") ??
    null
  );
}

function extractSummary(html: string, mainHtml: string, markdown: string) {
  const metaSummary =
    extractMetaTagContent(html, "name", "description") ??
    extractMetaTagContent(html, "property", "og:description");
  if (metaSummary) return truncateToWordBoundary(metaSummary, 280);

  const paragraph = extractFirstParagraphText(mainHtml);
  if (paragraph) return truncateToWordBoundary(paragraph, 280);

  const firstMarkdownParagraph = markdown.split(/\n{2,}/g).find((part) => Boolean(part.trim()));
  return truncateToWordBoundary(firstMarkdownParagraph ?? "", 280);
}

function extractHeaderImageUrl(html: string, mainHtml: string, pageUrl: string) {
  const ogImage = extractMetaTagContent(html, "property", "og:image");
  if (ogImage) return toAbsoluteHttpUrl(ogImage, pageUrl);

  const firstImage = extractFirstImageSrc(mainHtml) ?? extractFirstImageSrc(html);
  if (!firstImage) return null;
  return toAbsoluteHttpUrl(firstImage, pageUrl);
}

function extractMainContent(html: string) {
  const normalized = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "");

  const article = extractTagInnerHtml(normalized, "article");
  if (article) return article;
  const main = extractTagInnerHtml(normalized, "main");
  if (main) return main;
  const body = extractTagInnerHtml(normalized, "body");
  if (body) return body;
  return normalized;
}

function htmlToMarkdown(html: string, baseUrl: string) {
  let output = html;
  output = output.replace(/\r/g, "");
  output = output.replace(/<br\s*\/?>/gi, "\n");
  output = output.replace(/<hr[^>]*>/gi, "\n\n---\n\n");

  output = output.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, content) => `\n\n# ${cleanText(content)}\n\n`);
  output = output.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => `\n\n## ${cleanText(content)}\n\n`);
  output = output.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, content) => `\n\n### ${cleanText(content)}\n\n`);
  output = output.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, content) => `\n\n#### ${cleanText(content)}\n\n`);
  output = output.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, content) => `\n\n##### ${cleanText(content)}\n\n`);
  output = output.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, content) => `\n\n###### ${cleanText(content)}\n\n`);

  output = output.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `\n- ${cleanText(content)}`);
  output = output.replace(/<\/?(ul|ol)[^>]*>/gi, "\n");

  output = output.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => `\n\n> ${cleanText(content)}\n\n`);
  output = output.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, content) => `\n\n\`\`\`\n${cleanText(content)}\n\`\`\`\n\n`);
  output = output.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, content) => `\`${cleanText(content)}\``);

  output = output.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => {
      const resolvedHref = toAbsoluteHttpUrl(href, baseUrl);
      return resolvedHref ? `[${cleanText(text)}](${resolvedHref})` : cleanText(text);
    },
  );

  output = output.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi,
    (_, src, alt) => {
      const resolvedSrc = toAbsoluteHttpUrl(src, baseUrl);
      return resolvedSrc ? `\n\n![${cleanText(alt)}](${resolvedSrc})\n\n` : "";
    },
  );
  output = output.replace(
    /<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi,
    (_, alt, src) => {
      const resolvedSrc = toAbsoluteHttpUrl(src, baseUrl);
      return resolvedSrc ? `\n\n![${cleanText(alt)}](${resolvedSrc})\n\n` : "";
    },
  );
  output = output.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (_, src) => {
    const resolvedSrc = toAbsoluteHttpUrl(src, baseUrl);
    return resolvedSrc ? `\n\n![](${resolvedSrc})\n\n` : "";
  });

  output = output.replace(/<\/?(p|div|section|article|header|footer|figure|figcaption)[^>]*>/gi, "\n\n");
  output = output.replace(/<[^>]+>/g, "");

  output = decodeHtmlEntities(output);
  output = output
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
  output = output.replace(/\n{3,}/g, "\n\n");
  return output.trim();
}

function extractMetaTagContent(html: string, attrName: "name" | "property", attrValue: string) {
  const escaped = escapeRegExp(attrValue);
  const pattern = new RegExp(
    `<meta[^>]*${attrName}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const reversedPattern = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern) ?? html.match(reversedPattern);
  return match?.[1] ? cleanText(match[1]) : null;
}

function extractTagInnerHtml(html: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(pattern);
  return match?.[1] ?? null;
}

function extractTagText(html: string, tagName: string) {
  const inner = extractTagInnerHtml(html, tagName);
  return inner ? cleanText(inner) : null;
}

function extractFirstParagraphText(html: string) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return match?.[1] ? cleanText(match[1]) : null;
}

function extractFirstImageSrc(html: string) {
  const withQuotedSrc = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
  if (withQuotedSrc?.[1]) return withQuotedSrc[1].trim();
  const bareSrc = html.match(/<img[^>]*src=([^\s>]+)[^>]*>/i);
  if (bareSrc?.[1]) {
    return bareSrc[1].replace(/['"]/g, "").trim();
  }
  return null;
}

function toAbsoluteHttpUrl(value: string, baseUrl: string) {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanText(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function truncateToWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const safe = lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped;
  return `${safe.trim()}…`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
