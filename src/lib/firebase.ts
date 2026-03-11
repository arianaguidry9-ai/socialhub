import { initializeApp, cert, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function getFirebaseApp(): App {
  if (getApps().length > 0) return getApp();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    // During build / static generation, credentials may not exist.
    // Return a stub app — Firestore calls will only happen at runtime.
    return initializeApp({ projectId: 'stub-project' });
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let _firestore: Firestore | undefined;

export function getDb(): Firestore {
  if (!_firestore) {
    _firestore = getFirestore(getFirebaseApp());
  }
  return _firestore;
}

/** Convenience export — lazily initialised. */
export const firestore: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
