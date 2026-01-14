import { NextRequest } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";

const baseUrl = process.env.VENICE_API_BASE_URL ?? "https://api.venice.ai/api/v1";
const apiKey = process.env.VENICE_API_KEY ?? "";
const model = process.env.VENICE_MODEL ?? "";

type GenerateRequest = {
  context?: string;
  bio?: string;
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
  try {
    const body = (await request.json()) as GenerateRequest;
    context = String(body?.context ?? "").trim();
    bio = String(body?.bio ?? "").trim();
  } catch {
    context = "";
    bio = "";
  }

  const promptParts = [
    "Generate one D&D-style display name.",
    bio ? `Bio: ${bio}` : "",
    context ? `Extra context: ${context}` : "",
  ].filter(Boolean);
  const userPrompt = promptParts.join(" ");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You generate short fantasy display names. " +
            "Return only the name, no quotes, no punctuation, no extra text. " +
            "Keep it to 1-2 words.",
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 20,
    }),
  });

  if (!response.ok) {
    return Response.json({ error: "Generation failed." }, { status: 500 });
  }

  const json = await response.json();
  const content =
    json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || "";
  const name = String(content)
    .split("\n")[0]
    .replace(/["']/g, "")
    .trim();

  if (!name) {
    return Response.json({ error: "No name generated." }, { status: 500 });
  }

  return Response.json({ name });
}
