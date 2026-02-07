import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("handle, bio, roles, skills, location")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error || !data?.handle) {
    return Response.json({ error: "Profile not found." }, { status: 404 });
  }

  const webhookUrl =
    "https://n8n-workflows-production-d083.up.railway.app/webhook/latest-news";
  const heapId = process.env.HEAP_ID ?? "";
  if (!heapId) {
    return Response.json({ error: "Missing HEAP_ID." }, { status: 500 });
  }
  let webhookRes: Response;
  try {
    webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heapId,
        handle: data.handle,
        bio: data.bio ?? null,
        roles: data.roles ?? [],
        skills: data.skills ?? [],
        location: data.location ?? null,
      }),
    });
  } catch (error) {
    console.error("Daily brief webhook request failed:", error);
    return Response.json(
      {
        error: "Brief generation failed.",
        details:
          error instanceof Error ? error.message : "Webhook request failed.",
      },
      { status: 502 },
    );
  }

  if (!webhookRes.ok) {
    const errorBody = await webhookRes.text();
    console.error("Daily brief webhook error:", webhookRes.status, errorBody);
    return Response.json(
      {
        error: "Brief generation failed.",
        status: webhookRes.status,
        details: errorBody.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const payload = (await webhookRes.json()) as
    | { data?: Array<{ signedURL?: string; signedUrl?: string; url?: string }> }
    | Array<{ data?: Array<{ signedURL?: string; signedUrl?: string; url?: string }> }>;
  console.log("Daily brief webhook payload:", payload);

  const candidates = Array.isArray(payload)
    ? payload?.[0]?.data ?? []
    : payload?.data ?? [];
  const getPathname = (value: string) => {
    if (!value) return "";
    try {
      return new URL(value).pathname;
    } catch {
      return value.split("?")[0] ?? value;
    }
  };

  const audioEntry =
    candidates.find((item) =>
      getPathname(item.signedURL ?? item.signedUrl ?? item.url ?? "").endsWith(".mp3"),
    ) ?? candidates[0];
  const markdownEntry =
    candidates.find((item) =>
      getPathname(item.signedURL ?? item.signedUrl ?? item.url ?? "").endsWith(".md"),
    ) ?? null;
  const signedUrl =
    audioEntry?.signedURL ?? audioEntry?.signedUrl ?? audioEntry?.url ?? null;
  const markdownUrl =
    markdownEntry?.signedURL ?? markdownEntry?.signedUrl ?? markdownEntry?.url ?? null;
  const id = null;
  const key = null;

  if (!signedUrl) {
    console.error("Daily brief missing signed URL:", payload);
    return Response.json(
      { error: "Brief audio unavailable.", details: payload },
      { status: 502 },
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const resolvedUrl =
    signedUrl.startsWith("http") || !baseUrl ? signedUrl : `${baseUrl}${signedUrl}`;
  console.log("Daily brief resolved audio URL:", resolvedUrl);

  const resolvedMarkdownUrl =
    markdownUrl && (markdownUrl.startsWith("http") || !baseUrl)
      ? markdownUrl
      : markdownUrl
        ? `${baseUrl}${markdownUrl}`
        : null;

  return Response.json({
    audioUrl: resolvedUrl,
    audioKey: key,
    audioId: id,
    markdownUrl: resolvedMarkdownUrl,
  });
}
