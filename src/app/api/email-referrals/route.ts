import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-form-api-key",
};

const apiKey = process.env.FORM_INGEST_API_KEY ?? "";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
const EMAIL_COOLDOWN_MS = 60 * 60 * 1000;

const rateBuckets = new Map<string, number[]>();
const emailCooldowns = new Map<string, number>();

const isValidEmail = (value: string) =>
  /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
};

const getPayload = async (request: NextRequest) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }
  return {};
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  if (!apiKey) {
    return Response.json(
      { error: "Missing server configuration." },
      { status: 500, headers: corsHeaders },
    );
  }

  const headerKey = request.headers.get("x-form-api-key");
  if (!headerKey || headerKey !== apiKey) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: corsHeaders },
    );
  }

  const ip = getClientIp(request);
  const now = Date.now();
  const bucket = rateBuckets.get(ip) ?? [];
  const recent = bucket.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    rateBuckets.set(ip, recent);
    return Response.json(
      { error: "Too many requests." },
      { status: 429, headers: corsHeaders },
    );
  }
  recent.push(now);
  rateBuckets.set(ip, recent);

  const body = await getPayload(request);
  const email = String(body?.email ?? "").trim();
  const referral = String(body?.referral ?? "").trim();

  if (!email || !isValidEmail(email)) {
    return Response.json(
      { error: "Valid email required." },
      { status: 400, headers: corsHeaders },
    );
  }

  const normalizedEmail = email.toLowerCase();
  const lastEmail = emailCooldowns.get(normalizedEmail) ?? 0;
  if (now - lastEmail < EMAIL_COOLDOWN_MS) {
    return Response.json(
      { error: "Too many requests for this email." },
      { status: 429, headers: corsHeaders },
    );
  }

  const supabase = supabaseAdminClient();
  const { error } = await supabase.from("email_referrals").insert({
    email,
    referral: referral || null,
  });

  if (error?.code === "23505") {
    return Response.json(
      { error: "Email already registered." },
      { status: 409, headers: corsHeaders },
    );
  }

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }

  emailCooldowns.set(normalizedEmail, now);
  return Response.json({ ok: true }, { headers: corsHeaders });
}
