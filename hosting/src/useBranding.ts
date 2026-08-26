import { useEffect, useSyncExternalStore } from 'react';
import { getBranding, refreshBranding, subscribeBranding, type Branding } from './branding';

/**
 * App name and asset URLs, available synchronously from cache on first render
 * and refreshed from the API in the background.
 */
export function useBranding(): Branding {
  const branding = useSyncExternalStore(subscribeBranding, getBranding, getBranding);

  useEffect(() => {
    refreshBranding();
  }, []);

  return branding;
}

export default useBranding;
