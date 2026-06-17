import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
} as const;

const missingKeys = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value || value === 'your-api-key-here')
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(
    `Firebase config missing (${missingKeys.join(', ')}). ` +
      'Copy .env.example to .env (not "env") and add your Firebase web app values, then restart the dev server.'
  );
}

const firebaseConfig = { ...requiredEnvVars };

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
