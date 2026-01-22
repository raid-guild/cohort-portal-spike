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
    "https://n8n-workflows-production-d083.up.railway.app/webhook/0c317f9e-b65b-4599-9a4a-89cfccca6776";
  let webhookRes: Response;
  try {
    webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    | { signedUrl?: string; signedURL?: string; url?: string; Key?: string; Id?: string }
    | Array<{
        signedUrl?: string;
        signedURL?: string;
        url?: string;
        Key?: string;
        Id?: string;
      }>;
  console.log("Daily brief webhook payload:", payload);
  const entry = Array.isArray(payload) ? payload[0] : payload;
  const signedUrl = entry?.signedUrl ?? entry?.signedURL ?? entry?.url ?? null;
  const id = entry?.Id ?? null;
  const key = entry?.Key ?? null;

  if (!signedUrl) {
    console.error("Daily brief missing signed URL:", payload);
    return Response.json(
      { error: "Brief audio unavailable.", details: payload },
      { status: 502 },
    );
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const resolvedUrl =
    signedUrl.startsWith("http") || !baseUrl ? signedUrl : `${baseUrl}${signedUrl}`;

  return Response.json({
    audioUrl: resolvedUrl,
    audioKey: key,
    audioId: id,
  });
}
