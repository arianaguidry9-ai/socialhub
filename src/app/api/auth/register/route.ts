import { NextRequest, NextResponse } from 'next/server';
import { usersRef, generateId } from '@/lib/db';
import { hashPassword } from '@/lib/auth/passwords';
import { registerSchema } from '@/lib/validations';
import { logger } from '@/lib/logger';

/** POST /api/auth/register — Create a new account with email & password. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = registerSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already taken
    const existing = await usersRef.where('email', '==', normalizedEmail).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Create user document
    const userId = generateId();
    await usersRef.doc(userId).set({
      name,
      email: normalizedEmail,
      emailVerified: null,
      image: null,
      passwordHash: hashPassword(password),
      plan: 'FREE',
      timezone: 'UTC',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info({ userId, email: normalizedEmail }, 'New user registered via email/password');

    return NextResponse.json({ success: true, userId }, { status: 201 });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input', details: err.errors },
        { status: 400 }
      );
    }
    logger.error({ err }, 'Registration failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
