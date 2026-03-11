import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
    : getApp();

const firestore = getFirestore(app);

async function main() {
  console.log('Seeding Firestore...');

  // Create a demo user
  const usersRef = firestore.collection('users');
  const existingUsers = await usersRef.where('email', '==', 'demo@socialhub.app').limit(1).get();

  let userId: string;
  if (existingUsers.empty) {
    const doc = usersRef.doc();
    await doc.set({
      email: 'demo@socialhub.app',
      name: 'Demo User',
      plan: 'FREE',
      timezone: 'America/New_York',
      createdAt: new Date(),
    });
    userId = doc.id;
    console.log(`Created user: demo@socialhub.app (${userId})`);
  } else {
    userId = existingUsers.docs[0].id;
    console.log(`User already exists: demo@socialhub.app (${userId})`);
  }

  // Seed popular subreddit rule caches for dev
  const cacheRef = firestore.collection('subredditRulesCache');
  const subs = ['technology', 'programming', 'webdev', 'javascript'];
  for (const sub of subs) {
    await cacheRef.doc(sub).set(
      {
        subreddit: sub,
        rulesJson: { rules: [{ short_name: 'No spam', description: 'No spamming allowed' }] },
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { merge: true }
    );
  }

  console.log('Seed complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
