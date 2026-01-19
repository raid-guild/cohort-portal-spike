import { NextRequest } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  COHORT_ENTITLEMENT,
  getOrCreateStripeCustomer,
  getStripeClient,
  getStripePriceId,
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
    const priceId = getStripePriceId();
    const customer = await getOrCreateStripeCustomer(stripe, userData.user);
    const origin =
      request.headers.get("origin") ?? new URL(request.url).origin ?? "";

    if (!origin) {
      return Response.json({ error: "Missing request origin." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customer.id,
      client_reference_id: userData.user.id,
      success_url: `${origin}/modules/billing?checkout=success`,
      cancel_url: `${origin}/modules/billing?checkout=cancel`,
      subscription_data: {
        metadata: {
          supabase_user_id: userData.user.id,
          entitlement: COHORT_ENTITLEMENT,
        },
      },
      metadata: {
        supabase_user_id: userData.user.id,
        entitlement: COHORT_ENTITLEMENT,
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
