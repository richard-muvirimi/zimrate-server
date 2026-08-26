import { type ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Box, CircularProgress } from '@mui/material';
import { isPresetId } from '../theme/presets';
import { getPresetId, setPresetId } from '../theme/presetStore';

type Status = 'loading' | 'authenticated' | 'unverified' | 'unauthenticated';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('unauthenticated');
        return;
      }

      // Correct the locally cached theme preset before any admin chrome paints.
      // The spinner below is already showing, so the right palette is in place
      // by the time anything is visible — even on a brand-new device.
      try {
        const snap = await getDoc(doc(db, 'user_prefs', user.uid));
        const stored = snap.data()?.theme_preset;
        if (isPresetId(stored) && stored !== getPresetId()) setPresetId(stored);
      } catch {
        // Preference unreadable — the cached preset stands.
      }

      // Verification is enforced here, not just redirected to after sign-in:
      // otherwise an unverified account could reach /admin directly, or stay in
      // via a session established before this check existed.
      setStatus(user.emailVerified ? 'authenticated' : 'unverified');
    });
    return unsub;
  }, []);

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace />;
  }

  if (status === 'unverified') {
    return <Navigate to="/admin/verify-email" replace />;
  }

  return <>{children}</>;
}
