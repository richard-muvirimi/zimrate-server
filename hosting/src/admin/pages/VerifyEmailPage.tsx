import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/admin/login', { replace: true });
        return;
      }

      setEmail(user.email ?? '');

      if (user.emailVerified) {
        navigate('/admin', { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate]);

  const handleCheck = async () => {
    if (!auth.currentUser) {
      navigate('/admin/login', { replace: true });
      return;
    }

    setChecking(true);
    setError('');

    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        navigate('/admin', { replace: true });
      } else {
        setError('Email not yet verified. Click the verification link in your inbox, then try again.');
      }
    } catch {
      setError('Could not verify email status right now. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (!auth.currentUser) {
      navigate('/admin/login', { replace: true });
      return;
    }

    setResending(true);
    setError('');
    setSuccess('');

    try {
      await sendEmailVerification(auth.currentUser);
      setSuccess('Verification email sent. Check your inbox and spam folder.');
    } catch {
      setError('Failed to send verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/admin/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ width: '100%', maxWidth: 520, p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h4" color="primary" gutterBottom>
              Verify Your Email
            </Typography>
            <Typography color="text.secondary">
              A verification link was sent to <strong>{email || 'your account'}</strong>.
            </Typography>
          </Box>

          {success ? <Alert severity="success">{success}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Button variant="contained" size="large" onClick={handleCheck} disabled={checking}>
            {checking ? <CircularProgress size={22} color="inherit" /> : "I've Verified My Email"}
          </Button>

          <Button variant="outlined" size="large" onClick={handleResend} disabled={resending}>
            {resending ? <CircularProgress size={22} color="inherit" /> : 'Resend Verification Email'}
          </Button>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Link component={RouterLink} to="/admin/login" underline="hover" color="text.secondary">
              Back to sign in
            </Link>
            <Link component="button" type="button" underline="hover" color="text.secondary" onClick={handleSignOut}>
              Sign out and use a different account
            </Link>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}