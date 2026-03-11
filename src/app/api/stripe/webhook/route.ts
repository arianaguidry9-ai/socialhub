import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { usersRef } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';
import { logger } from '@/lib/logger';
import type Stripe from 'stripe';

/**
 * POST /api/stripe/webhook — Handle Stripe webhook events.
 * Must verify webhook signature for security.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = headers();
  const signature = headersList.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Stripe webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId) {
          await usersRef.doc(userId).update({
            plan: 'PREMIUM',
            stripeCustomerId: session.customer as string,
          });
          logger.info({ userId }, 'User upgraded to Premium');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const isActive = ['active', 'trialing'].includes(subscription.status);

        const snap = await usersRef.where('stripeCustomerId', '==', customerId).get();
        const batch = usersRef.firestore.batch();
        snap.docs.forEach((doc) => batch.update(doc.ref, { plan: isActive ? 'PREMIUM' : 'FREE' }));
        await batch.commit();

        logger.info({ customerId, status: subscription.status }, 'Subscription updated');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const snap = await usersRef.where('stripeCustomerId', '==', customerId).get();
        const batch = usersRef.firestore.batch();
        snap.docs.forEach((doc) => batch.update(doc.ref, { plan: 'FREE' }));
        await batch.commit();

        logger.info({ customerId }, 'Subscription canceled — downgraded to Free');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        logger.warn({ customerId }, 'Invoice payment failed');
        // Keep premium for now — Stripe will retry
        break;
      }

      default:
        logger.info({ type: event.type }, 'Unhandled webhook event type');
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, 'Error processing webhook');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
