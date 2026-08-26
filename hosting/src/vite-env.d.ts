/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;

  /** Base URL for API calls. Empty means same origin (hosting rewrite / dev proxy). */
  readonly VITE_API_BASE_URL?: string;
  /** Origin shown in copy-paste examples on the Developers / CTA sections. */
  readonly VITE_PUBLIC_API_ORIGIN?: string;

  /** reCAPTCHA v3 site key for App Check. Empty disables App Check. */
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  /** Fixed App Check debug token so one token survives dev restarts. */
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;

  /** Override the dev-server proxy target for /api. Defaults to the deployed API. */
  readonly VITE_DEV_API_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
