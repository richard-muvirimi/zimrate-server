const env = import.meta.env;

/**
 * Firebase web config. These values are public by design and are already in git
 * history, so the literals stay as fallbacks — a fresh clone with no env files
 * still builds and runs.
 */
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyB94uBt-ngmWU_DnzHZGTBb8TGEqYWUH4c',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'my-rate-calculator.firebaseapp.com',
  databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? 'https://my-rate-calculator.firebaseio.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'my-rate-calculator',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'my-rate-calculator.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '517253029311',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:517253029311:web:92941d0dc3e05d8ce0550a',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-EEX8605DQG',
};

/** Prefix for fetch calls. Empty = same origin, via the hosting rewrite or the dev proxy. */
export const API_BASE_URL = env.VITE_API_BASE_URL ?? '';

/** reCAPTCHA v3 site key. Empty disables App Check initialization. */
export const RECAPTCHA_SITE_KEY = env.VITE_RECAPTCHA_SITE_KEY ?? '';

export const APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN ?? '';

/**
 * Absolute URL for anything shown to the user as a copyable example.
 * Falls back to the current origin so local and preview builds show their own host.
 */
export function apiUrl(path: string): string {
  const origin = env.VITE_PUBLIC_API_ORIGIN || window.location.origin;
  return `${origin}${path}`;
}
