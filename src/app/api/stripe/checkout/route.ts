import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { usersRef } from '@/lib/db';
import { stripe, STRIPE_PRICES } from '@/lib/stripe/client';
import { logger } from '@/lib/logger';

/** POST /api/stripe/checkout — Create a Stripe Checkout session for Premium. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSnap = await usersRef.doc(session.user.id).get();
    const user = userSnap.data();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.plan === 'PREMIUM') {
      return NextResponse.json({ error: 'Already on Premium plan' }, { status: 400 });
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;
      await usersRef.doc(session.user.id).update({ stripeCustomerId: customerId });
    }

    // Default to monthly — frontend can pass billing=yearly for annual
    const body = await req.json().catch(() => ({}));
    const priceId = body.billing === 'yearly' ? STRIPE_PRICES.yearly : STRIPE_PRICES.monthly;

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/settings?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/settings?canceled=true`,
      metadata: { userId: session.user.id },
    });

    logger.info({ userId: session.user.id, sessionId: checkoutSession.id }, 'Stripe checkout created');

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    logger.error({ err }, 'Stripe checkout failed');
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
