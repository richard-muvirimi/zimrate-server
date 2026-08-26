import type { ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { useMemo } from 'react';
import { buildTheme } from './theme/buildTheme';
import { usePresetId } from './theme/usePresetId';

/**
 * Theme root.
 *
 * The preset comes from a synchronous localStorage-backed store, never from an
 * async read — so the theme is available at first render and there is no flash
 * of the wrong palette. Firestore only corrects the stored value later, from
 * inside the admin chunk, which is also why this file must not import
 * firebase/*: it sits above the whole tree, including the public site.
 */
export default function ThemedRoot({ children }: { children: ReactNode }) {
  const presetId = usePresetId();
  const theme = useMemo(() => buildTheme(presetId), [presetId]);

  return (
    <ThemeProvider
      theme={theme}
      defaultMode="dark"
      modeStorageKey="zimrate-mode"
      colorSchemeStorageKey="zimrate-color-scheme"
    >
      {children}
    </ThemeProvider>
  );
}
