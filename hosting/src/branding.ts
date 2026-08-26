import { API_BASE_URL } from './config';

/**
 * Branding for the public site.
 *
 * Deliberately does NOT import firebase/* — the landing bundle is kept
 * Firebase-free, so this reads the public /api/branding endpoint instead of
 * Firestore. The last response is mirrored into localStorage so a repeat visit
 * paints the right name immediately rather than flashing the default.
 */
export interface Branding {
  app_name: string;
  tagline: string;
  author_name: string;
  author_email: string;
  author_url: string;
  icon_url: string;
  og_image_url: string;
}

export const BRANDING_STORAGE_KEY = 'zimrate-branding';

/**
 * Empty placeholders, not values.
 *
 * The server owns every default (see BrandingService DEFAULTS) — duplicating
 * them here would give two sources of truth that drift, and worse, would let a
 * stale literal override an admin who deliberately cleared a field. Anything
 * blank is simply not rendered.
 */
export const DEFAULT_BRANDING: Branding = {
  app_name: '',
  tagline: '',
  author_name: '',
  author_email: '',
  author_url: '',
  icon_url: '',
  og_image_url: '',
};

function readCache(): Branding | null {
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Branding>;
    if (typeof parsed.app_name !== 'string') return null;
    return { ...DEFAULT_BRANDING, ...parsed };
  } catch {
    return null;
  }
}

let current: Branding = readCache() ?? DEFAULT_BRANDING;
const listeners = new Set<() => void>();

export function getBranding(): Branding {
  return current;
}

export function subscribeBranding(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function publish(next: Branding) {
  // Stable reference when nothing changed — useSyncExternalStore would
  // otherwise re-render on every fetch.
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((cb) => cb());
}

let fetched = false;

/** Refreshes from the API. Safe to call repeatedly; only the first call fetches. */
export function refreshBranding(): void {
  if (fetched) return;
  fetched = true;

  fetch(`${API_BASE_URL}/api/branding`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data: Partial<Branding> | null) => {
      if (!data || typeof data.app_name !== 'string') return;
      const next = { ...DEFAULT_BRANDING, ...data };
      publish(next);
      try {
        localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode — falls back to a fetch on next load.
      }
    })
    .catch(() => {
      // Offline or not deployed yet: the cached or default value stands.
    });
}
