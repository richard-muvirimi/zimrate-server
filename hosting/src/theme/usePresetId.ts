import { useSyncExternalStore } from 'react';
import { getPresetId, subscribePreset } from './presetStore';
import type { PresetId } from './presets';

/** Current theme preset, synchronously available on first render. */
export function usePresetId(): PresetId {
  return useSyncExternalStore(subscribePreset, getPresetId, getPresetId);
}

export default usePresetId;
