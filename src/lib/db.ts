import { firestore } from './firebase';

// ─── Collection References ────────────────────────────────────────────────────

export const usersRef = firestore.collection('users');
export const accountsRef = firestore.collection('accounts');
export const socialAccountsRef = firestore.collection('socialAccounts');
export const postsRef = firestore.collection('posts');
export const postTargetsRef = firestore.collection('postTargets');
export const postMetricsRef = firestore.collection('postMetrics');
export const subredditRulesCacheRef = firestore.collection('subredditRulesCache');
export const aiUsageRef = firestore.collection('aiUsage');
export const teamsRef = firestore.collection('teams');
export const teamMembersRef = firestore.collection('teamMembers');
export const jobsRef = firestore.collection('jobs');

/** Generate a unique Firestore document ID. */
export function generateId(): string {
  return firestore.collection('_').doc().id;
}

/** Extract document data with id, or null if document doesn't exist. */
export function docData<T = Record<string, any>>(
  snap: FirebaseFirestore.DocumentSnapshot
): (T & { id: string }) | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as T & { id: string };
}

/** Batch-fetch documents by ID (handles Firestore 'in' operator 30-item limit). */
export async function batchGetByIds(
  collection: FirebaseFirestore.CollectionReference,
  ids: string[]
): Promise<Map<string, Record<string, any>>> {
  const map = new Map<string, Record<string, any>>();
  if (ids.length === 0) return map;
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30);
    const snap = await collection.where('__name__', 'in', batch).get();
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
  }
  return map;
}

export { firestore };
