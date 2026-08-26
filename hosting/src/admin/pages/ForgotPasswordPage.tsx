import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setSuccess('');

    try {
      await sendPasswordResetEmail(auth, email);
    } finally {
      setSuccess('If an account exists with that email, a reset link has been sent.');
      setEmail('');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ width: '100%', maxWidth: 460, p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h4" color="primary" gutterBottom>
              Reset Password
            </Typography>
            <Typography color="text.secondary">
              Enter your email address and we will send a password reset link.
            </Typography>
          </Box>

          {success ? <Alert severity="success">{success}</Alert> : null}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              fullWidth
            />

            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Send Reset Link'}
            </Button>
          </Box>

          <Link component={RouterLink} to="/admin/login" underline="hover" color="text.secondary">
            Back to sign in
          </Link>
        </Stack>
      </Paper>
    </Box>
  );
}