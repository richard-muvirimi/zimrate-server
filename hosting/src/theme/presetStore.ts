import { DEFAULT_PRESET, isPresetId, type PresetId } from './presets';

/**
 * The selected preset, held outside React so it is available synchronously at
 * first render.
 *
 * This must NOT import firebase/* — it is read by the theme root, which sits
 * above everything, and pulling the Firebase SDK in there would drag it onto
 * the public landing page. Firestore only *corrects* this value later, from
 * inside the admin chunk.
 */
export const PRESET_STORAGE_KEY = 'zimrate-preset';

function read(): PresetId {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    return isPresetId(raw) ? raw : DEFAULT_PRESET;
  } catch {
    return DEFAULT_PRESET;
  }
}

// Cached so getSnapshot returns a stable value — useSyncExternalStore loops
// forever otherwise.
let current: PresetId = read();
const listeners = new Set<() => void>();

export function getPresetId(): PresetId {
  return current;
}

export function setPresetId(id: PresetId): void {
  if (id === current) return;
  current = id;
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, id);
  } catch {
    // Private mode — the choice just won't survive a reload.
  }
  document.documentElement.setAttribute('data-zimrate-preset', id);
  listeners.forEach((cb) => cb());
}

export function subscribePreset(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
