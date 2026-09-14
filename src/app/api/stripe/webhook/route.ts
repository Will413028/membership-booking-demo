import type Stripe from "stripe";

import { processStripeEvent } from "@/lib/stripe/events";
import { getStripeClient } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();

  if (!webhookSecret) {
    return new Response("Stripe webhook is not configured.", { status: 500 });
  }

  if (!signature) {
    return new Response("Invalid Stripe signature.", { status: 400 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return new Response("Stripe webhook is not configured.", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return new Response("Invalid Stripe signature.", { status: 400 });
  }

  try {
    await processStripeEvent(event);
  } catch {
    return new Response("Unable to process Stripe event.", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
