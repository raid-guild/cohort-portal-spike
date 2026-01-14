import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

const baseUrl = process.env.VENICE_API_BASE_URL ?? "https://api.venice.ai/api/v1";
const apiKey = process.env.VENICE_API_KEY ?? "";
const model = process.env.VENICE_IMAGE_MODEL ?? "venice-sd35";

type GenerateRequest = {
  context?: string;
  bio?: string;
  displayName?: string;
};

export async function POST(request: NextRequest) {
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

  if (!apiKey || !model) {
    return Response.json(
      { error: "Missing Venice API configuration." },
      { status: 500 },
    );
  }

  let context = "";
  let bio = "";
  let displayName = "";
  try {
    const body = (await request.json()) as GenerateRequest;
    context = String(body?.context ?? "").trim();
    bio = String(body?.bio ?? "").trim();
    displayName = String(body?.displayName ?? "").trim();
  } catch {
    context = "";
    bio = "";
    displayName = "";
  }

  const promptParts = [
    "Fantasy portrait, D&D-inspired and Finalfantasy video game inspired, cinematic lighting, detailed, friendly.",
    displayName ? `Name: ${displayName}.` : "",
    bio ? `Bio: ${bio}` : "",
    context ? `Extra context: ${context}` : "",
  ].filter(Boolean);

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: promptParts.join(" "),
      size: "512x512",
      n: 1,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    return Response.json({ error: "Generation failed." }, { status: 500 });
  }

  const json = await response.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    return Response.json({ error: "No image generated." }, { status: 500 });
  }

  const buffer = Buffer.from(b64, "base64");
  const path = `${userData.user.id}/avatar-generated-${Date.now()}.png`;
  const admin = supabaseAdminClient();
  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, buffer, {
      upsert: true,
      contentType: "image/png",
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicData } = admin.storage.from("avatars").getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", userData.user.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ url: publicUrl });
}
