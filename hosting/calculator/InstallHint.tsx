import { useState } from 'react';
import { Alert, Box } from '@mui/material';
import IosShareIcon from '@mui/icons-material/IosShare';
import { isStandalone } from './standalone';

const DISMISSED_KEY = 'zimrate-calculator-install-hint';

/**
 * Safari offers no install prompt — `beforeinstallprompt` is Chromium only — so
 * on iOS the only route onto the Home Screen is the share sheet, and a user who
 * does not know that never installs. This says so once, and stays dismissed.
 *
 * Not shown when the app is already running standalone, nor on platforms whose
 * browser prompts on its own.
 */
function shouldShow(): boolean {
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return false;
  } catch {
    /* Storage blocked — showing the hint again is harmless. */
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return isIos && !isStandalone();
}

export default function InstallHint() {
  const [show, setShow] = useState(shouldShow);

  if (!show) return null;

  return (
    <Alert
      severity="info"
      variant="outlined"
      sx={{ mb: 2 }}
      onClose={() => {
        try {
          localStorage.setItem(DISMISSED_KEY, '1');
        } catch {
          /* Nothing to do — it will simply be shown again. */
        }
        setShow(false);
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        Install this: tap Share
        <IosShareIcon fontSize="inherit" />
        then <strong>Add to Home Screen</strong>, and it works offline.
      </Box>
    </Alert>
  );
}
