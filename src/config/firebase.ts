/**
 * Firebase Configuration
 *
 * Initializes Firebase Admin SDK with credentials from environment variables
 * or local service account file.
 */

import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('Firebase');

let db: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK
 * @returns Firestore database instance
 */
export function initializeFirebase(): Firestore {
  if (db) {
    logger.warn('Firebase already initialized, returning existing instance');
    return db;
  }

  let serviceAccount: admin.ServiceAccount;

  // Check if running in production with environment variable
  if (
    process.env.FIREBASE_SERVICE_ACCOUNT &&
    process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 0
  ) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      logger.info('Loaded Firebase credentials from environment variable');
    } catch (error) {
      logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable', error);
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT environment variable');
    }
  } else {
    // Local development - load from file
    const serviceAccountPath = path.join(
      __dirname,
      '../../firebase-service-account.json'
    );

    if (!fs.existsSync(serviceAccountPath)) {
      logger.error('Firebase service account file not found and FIREBASE_SERVICE_ACCOUNT env var not set');
      throw new Error(
        'Please set FIREBASE_SERVICE_ACCOUNT environment variable or provide firebase-service-account.json'
      );
    }

    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    logger.info('Loaded Firebase credentials from local file');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    db = admin.firestore();
    logger.info('Firebase initialized successfully');

    return db;
  } catch (error) {
    logger.error('Failed to initialize Firebase', error);
    throw error;
  }
}

/**
 * Get Firestore database instance
 * @throws Error if Firebase has not been initialized
 */
export function getFirestore(): Firestore {
  if (!db) {
    throw new Error('Firebase has not been initialized. Call initializeFirebase() first.');
  }
  return db;
}
