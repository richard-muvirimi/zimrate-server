import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
  type AppCheck,
} from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig, RECAPTCHA_SITE_KEY, APPCHECK_DEBUG_TOKEN } from './config';

// Explicit opt-in only: set VITE_APPCHECK_DEBUG_TOKEN and register the token in
// the Firebase console. Nothing here inspects the environment on its own.
if (APPCHECK_DEBUG_TOKEN) {
  (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
    APPCHECK_DEBUG_TOKEN;
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Registered before getFirestore so the provider is in place ahead of the first
// Firestore request. Skipped when no site key is configured.
let appCheck: AppCheck | null = null;
if (RECAPTCHA_SITE_KEY) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
// Only imported from src/admin/**, so this stays out of the public bundle.
export const storage = getStorage(app);

/**
 * App Check token for outgoing admin requests, or null when App Check is not
 * configured or reCAPTCHA is unreachable. Null-tolerant on purpose: an outage
 * should degrade to a 401 from auth, not crash the admin UI.
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    const { token } = await getToken(appCheck, false);
    return token;
  } catch (err) {
    console.warn('[appCheck] token unavailable', err);
    return null;
  }
}

export default app;
