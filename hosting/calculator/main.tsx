import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline } from '@mui/material';
// Latin subsets only, unlike the main site. The full imports pull cyrillic,
// greek and vietnamese too — 18 font files into the offline precache instead of
// 3, for glyphs a currency list will not use. A country name that needs them
// falls back to a system font.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import ThemedRoot from '../src/ThemedRoot';
import CalculatorApp from './CalculatorApp';

/**
 * Ask the browser to exempt this origin from storage eviction.
 *
 * iOS grants it inconsistently and can clear an app's storage after a stretch of
 * disuse, so this is an improvement in the odds, never a guarantee — the app has
 * to survive coming back to an empty store, which is why the rates list shows an
 * empty state with a refresh rather than treating missing rates as an error.
 */
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {
    /* Not supported, or refused. Nothing to do either way. */
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Shares the site's theme store, so a mode or preset chosen on the main
        site carries over. ThemedRoot reads it synchronously from localStorage
        and imports no firebase, which is what makes it safe to use offline. */}
    <ThemedRoot>
      <CssBaseline />
      <CalculatorApp />
    </ThemedRoot>
  </StrictMode>,
);
