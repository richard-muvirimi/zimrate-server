import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, Button, Alert, Switch,
  FormControlLabel, CircularProgress, Divider, InputAdornment, IconButton,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import BoltIcon from '@mui/icons-material/Bolt';
import { adminFetch } from '../adminFetch';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_name: string;
  from_email: string;
  recipient: string;
  enabled: boolean;
  /** The password itself is never sent to the client. */
  password_set?: boolean;
}

const EMPTY: SmtpConfig = {
  host: '',
  port: 587,
  secure: false,
  username: '',
  from_name: 'ZimRate',
  from_email: '',
  recipient: '',
  enabled: false,
  password_set: false,
};

export default function SmtpPage() {
  const [config, setConfig] = useState<SmtpConfig>(EMPTY);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    adminFetch<SmtpConfig>('/api/admin/smtp')
      .then((data) => setConfig({ ...EMPTY, ...data }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof SmtpConfig>(key: K, value: SmtpConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Only send the password when the admin actually typed a new one,
      // otherwise the stored value is kept.
      const payload: Record<string, unknown> = { ...config };
      delete payload.password_set;
      if (password) payload.password = password;

      const updated = await adminFetch<SmtpConfig>('/api/admin/smtp', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setConfig({ ...EMPTY, ...updated });
      setPassword('');
      setSuccess('Settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      const result = await adminFetch<{ verified: boolean; sent: boolean }>(
        '/api/admin/smtp/test',
        {
          method: 'POST',
          body: JSON.stringify(testTo ? { send_to: testTo } : {}),
        },
      );
      setSuccess(
        result.sent
          ? `Connected successfully and sent a test message to ${testTo}.`
          : 'Connected successfully — credentials accepted.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth={760}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Email / SMTP
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Used to deliver contact form submissions. Credentials are stored server-side and are
        never sent back to this page.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2.5}>
          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={(e) => set('enabled', e.target.checked)}
              />
            }
            label="Contact form enabled"
          />

          <Divider />

          <Typography variant="subtitle2" fontWeight={700}>Server</Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="SMTP host"
              value={config.host}
              onChange={(e) => set('host', e.target.value)}
              fullWidth
              placeholder="smtp.example.com"
            />
            <TextField
              label="Port"
              type="number"
              value={config.port}
              onChange={(e) => set('port', Number(e.target.value))}
              sx={{ maxWidth: { sm: 140 } }}
            />
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={config.secure}
                onChange={(e) => set('secure', e.target.checked)}
              />
            }
            label="Implicit TLS (usually port 465; leave off for STARTTLS on 587)"
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Username"
              value={config.username}
              onChange={(e) => set('username', e.target.value)}
              fullWidth
              autoComplete="off"
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
              placeholder={config.password_set ? '•••••••• (unchanged)' : ''}
              helperText={
                config.password_set
                  ? 'A password is stored. Leave blank to keep it.'
                  : 'No password stored yet.'
              }
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>

          <Divider />

          <Typography variant="subtitle2" fontWeight={700}>Addresses</Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="From name"
              value={config.from_name}
              onChange={(e) => set('from_name', e.target.value)}
              fullWidth
            />
            <TextField
              label="From email"
              type="email"
              value={config.from_email}
              onChange={(e) => set('from_email', e.target.value)}
              fullWidth
              helperText="Defaults to the username if left blank."
            />
          </Stack>

          <TextField
            label="Deliver submissions to"
            type="email"
            value={config.recipient}
            onChange={(e) => set('recipient', e.target.value)}
            fullWidth
            helperText="Where contact form messages are sent."
          />

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </Button>

            <TextField
              label="Send test to (optional)"
              type="email"
              size="small"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              sx={{ flexGrow: 1 }}
            />

            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={testing}
              startIcon={testing ? <CircularProgress size={18} /> : <BoltIcon />}
            >
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Test verifies the connection and credentials against the saved settings. Save first
            if you have just changed them. Add an address to also send a real test message.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
