import Stripe from "stripe";
import type { User } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const stripePriceId = process.env.STRIPE_PRICE_ID ?? "";
const stripePortalConfigId = process.env.STRIPE_PORTAL_CONFIG_ID ?? "";

export const COHORT_ENTITLEMENT = "cohort-access";

export const getStripeClient = () => {
  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }
  return new Stripe(stripeSecretKey, { apiVersion: "2025-12-15.clover" });
};

export const getStripePriceId = () => {
  if (!stripePriceId) {
    throw new Error("Missing STRIPE_PRICE_ID.");
  }
  return stripePriceId;
};

export const getStripeWebhookSecret = () => {
  if (!stripeWebhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }
  return stripeWebhookSecret;
};

export const getStripePortalConfigId = () => stripePortalConfigId || null;

export const getOrCreateStripeCustomer = async (stripe: Stripe, user: User) => {
  let customer: Stripe.Customer | null = null;

  try {
    const existing = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${user.id}'`,
      limit: 1,
    });
    customer = existing.data[0] ?? null;
  } catch (error) {
    if (user.email) {
      const existing = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      customer = existing.data[0] ?? null;
    }
  }

  if (customer) {
    return customer;
  }

  return stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { supabase_user_id: user.id },
  });
};
