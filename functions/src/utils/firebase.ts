/**
 * Firebase Admin Utility
 *
 * Provides lazy-initialized Firebase services to avoid
 * "app not initialized" errors during module loading.
 */

import * as admin from "firebase-admin";

// Initialize app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Lazy-initialized Firestore instance
let _db: admin.firestore.Firestore | null = null;

export function getDb(): admin.firestore.Firestore {
  if (!_db) {
    _db = admin.firestore();
  }
  return _db;
}

export { admin };
