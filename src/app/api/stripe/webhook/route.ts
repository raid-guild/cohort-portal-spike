import type Stripe from "stripe";
import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/db";
import {
  COHORT_ENTITLEMENT,
  getStripeClient,
  getStripePriceId,
  getStripeWebhookSecret,
} from "@/lib/stripe";

export const runtime = "nodejs";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

const subscriptionHasPrice = (subscription: Stripe.Subscription, priceId: string) =>
  subscription.items.data.some((item) => item.price?.id === priceId);

const invoiceHasPrice = (invoice: Stripe.Invoice, priceId: string) =>
  invoice.lines?.data?.some((line) => {
    const price = line.pricing?.price_details?.price;
    const linePriceId = typeof price === "string" ? price : price?.id;
    return linePriceId === priceId;
  }) ?? false;

const resolveUserIdFromCustomer = async (
  stripe: Stripe,
  customerId?: string | null,
) => {
  if (!customerId) return null;
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) {
    return null;
  }
  return customer.metadata?.supabase_user_id ?? null;
};

const upsertEntitlement = async (
  userId: string,
  status: string,
  metadata?: Json,
) => {
  const admin = supabaseAdminClient();
  const { error } = await admin
    .from("entitlements")
    .upsert(
      {
        user_id: userId,
        entitlement: COHORT_ENTITLEMENT,
        status,
        ...(metadata ? { metadata } : {}),
      },
      { onConflict: "user_id,entitlement" },
    );

  if (error) {
    throw new Error(error.message);
  }
};

const getSubscriptionPeriodEnd = (subscription: Stripe.Subscription) => {
  const maybe = (subscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  return typeof maybe === "number" ? maybe : null;
};

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const priceId = getStripePriceId();
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature.";
    console.error("Stripe webhook signature error:", message);
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    console.info("Stripe webhook received:", event.type, event.id);
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (!subscriptionHasPrice(subscription, priceId)) break;
        const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);
        const userId =
          session.client_reference_id ??
          session.metadata?.supabase_user_id ??
          (await resolveUserIdFromCustomer(
            stripe,
            typeof session.customer === "string" ? session.customer : null,
          ));
        if (!userId) break;
        const status = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
          ? "active"
          : "inactive";
        await upsertEntitlement(userId, status, {
          source: "stripe",
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: subscriptionId,
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          cancel_at: subscription.cancel_at ?? null,
          current_period_end: currentPeriodEnd,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (!subscriptionHasPrice(subscription, priceId)) break;
        const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);
        console.info("Stripe subscription metadata:", {
          id: subscription.id,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: subscription.cancel_at ?? null,
          current_period_end: currentPeriodEnd,
        });
        const userId =
          subscription.metadata?.supabase_user_id ??
          (await resolveUserIdFromCustomer(
            stripe,
            typeof subscription.customer === "string" ? subscription.customer : null,
          ));
        if (!userId) break;
        const status =
          event.type === "customer.subscription.deleted"
            ? "inactive"
            : ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
              ? "active"
              : "inactive";
        await upsertEntitlement(userId, status, {
          source: "stripe",
          stripe_customer_id:
            typeof subscription.customer === "string" ? subscription.customer : null,
          stripe_subscription_id: subscription.id,
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          cancel_at: subscription.cancel_at ?? null,
          current_period_end: currentPeriodEnd,
        });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoiceHasPrice(invoice, priceId)) break;
        const userId = await resolveUserIdFromCustomer(
          stripe,
          typeof invoice.customer === "string" ? invoice.customer : null,
        );
        if (!userId) break;
        const status = event.type === "invoice.paid" ? "active" : "inactive";
        const subscription =
          invoice.parent?.subscription_details?.subscription ?? null;
        await upsertEntitlement(userId, status, {
          source: "stripe",
          stripe_customer_id:
            typeof invoice.customer === "string" ? invoice.customer : null,
          stripe_subscription_id:
            typeof subscription === "string" ? subscription : null,
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed.";
    console.error("Stripe webhook handler error:", event.type, event.id, message);
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ received: true });
}
