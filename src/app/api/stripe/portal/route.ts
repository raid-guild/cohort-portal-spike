import { NextRequest } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  getOrCreateStripeCustomer,
  getStripeClient,
  getStripePortalConfigId,
} from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
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

    const stripe = getStripeClient();
    const customer = await getOrCreateStripeCustomer(stripe, userData.user);
    const origin =
      request.headers.get("origin") ?? new URL(request.url).origin ?? "";

    if (!origin) {
      return Response.json({ error: "Missing request origin." }, { status: 400 });
    }

    const portalConfigId = getStripePortalConfigId();
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/modules/billing`,
      ...(portalConfigId ? { configuration: portalConfigId } : {}),
    });

    return Response.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
