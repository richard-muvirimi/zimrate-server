import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Divider, Link, List, ListItem,
  ListItemText, Stack, TextField, Typography,
} from '@mui/material';
import {
  GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut,
  type User,
} from 'firebase/auth';
import { auth, getAppCheckToken } from '../firebase';
import { API_BASE_URL } from '../config';
import PageHero from '../components/PageHero';
import SiteLayout from '../components/SiteLayout';

/**
 * Self-service account deletion, for Google Play's requirement that the option stay reachable
 * after the app has been uninstalled.
 *
 * Sign-in is the identity check. There is no token to email and no request to queue, because
 * proving you hold the credential is the same proof either of those would have been reaching for,
 * and it makes the deletion immediate rather than a promise to act within thirty days.
 *
 * It does not run on the client. The database rules deny a client the write, so the page asks the
 * API with the user's own token and the same endpoint the app calls does the work.
 */

/** Typed in full before the button arms. Deletion is immediate and has no undo. */
const CONFIRM_WORD = 'DELETE';

const DELETED = [
  'Coins you have earned or bought, and the history behind them',
  'What you have spent coins on',
  'Currencies and rates you have added, pinned or hidden',
  'Your sign-in itself — email address or linked Google account',
];

type Stage = 'signIn' | 'confirm' | 'done';

export default function DeleteAccountPage() {
  const [stage, setStage] = useState<Stage>('signIn');
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * An admin signing in here would be deleting the account that runs the site, and the public
   * page is the wrong place to make that possible. Checked after sign-in rather than before,
   * because the claim is only readable once there is a token.
   */
  const accept = async (signedIn: User) => {
    const { claims } = await signedIn.getIdTokenResult();

    if (claims.admin) {
      await signOut(auth);
      setError('This is an administrator account. Manage it from the admin area instead.');
      return;
    }

    setUser(signedIn);
    setStage('confirm');
  };

  const withBusy = async (work: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await work();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithPassword = (e: React.FormEvent) => {
    e.preventDefault();
    return withBusy(async () => {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await accept(credential.user);
    });
  };

  const signInWithGoogle = () => withBusy(async () => {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    await accept(credential.user);
  });

  const deleteAccount = () => withBusy(async () => {
    if (!user) return;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${await user.getIdToken(true)}`,
    };

    const appCheckToken = await getAppCheckToken();
    if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;

    const res = await fetch(`${API_BASE_URL}/api/account`, { method: 'DELETE', headers });

    if (!res.ok) {
      const body = await res.text();
      let message = body || `Deletion failed: ${res.status}`;
      try {
        message = (JSON.parse(body) as { error?: string }).error ?? message;
      } catch {
        // Not JSON — keep the raw text.
      }
      throw new Error(message);
    }

    // The account is gone, so the session is meaningless; clearing it stops the page sitting on
    // a signed-in user that no longer exists.
    await signOut(auth);
    setStage('done');
  });

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Account"
        title="Delete your account"
        description="Sign in with the account you use in the ZimRate app and remove it, along with everything stored against it. This cannot be undone."
      />

      <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 6, md: 8 } }}>
        <Box sx={{ maxWidth: 640, mx: 'auto' }}>
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {stage === 'signIn' && (
            <Stack
              spacing={3}
              sx={{
                p: { xs: 3, md: 4 },
                border: '1px solid', borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
              }}
            >
              <Typography color="text.secondary">
                Signing in is how we confirm the account is yours. Use the same email address or
                Google account you signed into the app with.
              </Typography>

              <Button
                variant="outlined"
                size="large"
                onClick={signInWithGoogle}
                disabled={busy}
                fullWidth
              >
                Continue with Google
              </Button>

              <Divider>or</Divider>

              <Box
                component="form"
                onSubmit={signInWithPassword}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <TextField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                />
                <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth>
                  {busy ? <CircularProgress size={24} color="inherit" /> : 'Sign in to continue'}
                </Button>
              </Box>

              {/* Anyone who only ever used the app without signing in has no credential to offer
                  here — their data is tied to an anonymous id the app created, and deleting the
                  app removes their access to it. The contact form is the route for them. */}
              <Typography variant="body2" color="text.secondary">
                Never signed in, or cannot sign in any more?{' '}
                <Link component={RouterLink} to="/contact" underline="hover">
                  Send us a deletion request
                </Link>{' '}
                and we will action it for you.
              </Typography>
            </Stack>
          )}

          {stage === 'confirm' && (
            <Stack
              spacing={3}
              sx={{
                p: { xs: 3, md: 4 },
                border: '1px solid', borderColor: 'error.main',
                borderRadius: 3,
                bgcolor: 'background.paper',
              }}
            >
              <Box>
                <Typography variant="overline" color="text.secondary">Signed in as</Typography>
                <Typography variant="h6">{user?.email || user?.displayName}</Typography>
              </Box>

              <Box>
                <Typography gutterBottom>Deleting this account permanently removes:</Typography>
                <List dense disablePadding>
                  {DELETED.map((item) => (
                    <ListItem key={item} sx={{ pl: 0 }}>
                      <ListItemText primary={`• ${item}`} />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Alert severity="warning">
                Coins you paid for are included and cannot be restored or refunded. Google keeps its
                own record of the purchase itself, which is outside our control.
              </Alert>

              <TextField
                label={`Type ${CONFIRM_WORD} to confirm`}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                fullWidth
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  onClick={deleteAccount}
                  disabled={busy || confirmation.trim() !== CONFIRM_WORD}
                >
                  {busy ? <CircularProgress size={24} color="inherit" /> : 'Delete permanently'}
                </Button>
                <Button
                  variant="text"
                  size="large"
                  color="inherit"
                  disabled={busy}
                  onClick={() => withBusy(async () => {
                    await signOut(auth);
                    setUser(null);
                    setConfirmation('');
                    setStage('signIn');
                  })}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          )}

          {stage === 'done' && (
            <Stack
              spacing={3}
              sx={{
                p: { xs: 3, md: 4 },
                border: '1px solid', borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
              }}
            >
              <Alert severity="success">Your account and its data have been deleted.</Alert>
              <Typography color="text.secondary">
                Nothing is left to restore. If the app is still installed it will start again as a
                new, empty account the next time you open it. You are welcome back any time.
              </Typography>
              <Box>
                <Button component={RouterLink} to="/" variant="outlined">
                  Back to ZimRate
                </Button>
              </Box>
            </Stack>
          )}
        </Box>
      </Box>
    </SiteLayout>
  );
}
