import { useEffect, useState } from 'react';
import {
  Box, Stack, TextField, Button, Alert, Typography, CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SiteLayout from '../components/SiteLayout';
import PageHero from '../components/PageHero';
import SafeEmail from '../components/SafeEmail';
import { API_BASE_URL } from '../config';
import { useBranding } from '../useBranding';

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Honeypot — must stay empty. Hidden from real users. */
  website: string;
}

const EMPTY: FormState = { name: '', email: '', subject: '', message: '', website: '' };

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const branding = useBranding();

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/contact`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => active && setEnabled(Boolean(d.enabled)))
      .catch(() => active && setEnabled(false));
    return () => {
      active = false;
    };
  }, []);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed: ${res.status}`);
      setSent(true);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        description="Questions about the API, a bug to report, or a feature you need — send a message and it goes straight to the maintainer."
      />

      <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 6, md: 8 } }}>
        <Box sx={{ maxWidth: 700, mx: 'auto' }}>
          {enabled === null && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {enabled === false && (
            <Alert severity="info">
              The contact form is not available right now.
              {branding.author_email && (
                <>
                  {' '}You can still reach us by email at{' '}
                  <SafeEmail email={branding.author_email} underline="hover" />.
                </>
              )}
            </Alert>
          )}

          {enabled && sent && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSent(false)}>
              Thanks — your message has been sent. You'll get a reply at the address you gave.
            </Alert>
          )}

          {enabled && (
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                p: { xs: 3, md: 4 },
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
              }}
            >
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <Stack spacing={2.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
                  <TextField
                    label="Your name"
                    value={form.name}
                    onChange={set('name')}
                    required
                    fullWidth
                    slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }}
                  />
                  <TextField
                    label="Your email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    required
                    fullWidth
                    helperText="Used only to reply to you."
                  />
                </Stack>

                <TextField
                  label="Subject"
                  value={form.subject}
                  onChange={set('subject')}
                  required
                  fullWidth
                  slotProps={{ htmlInput: { minLength: 3, maxLength: 150 } }}
                />

                <TextField
                  label="Message"
                  value={form.message}
                  onChange={set('message')}
                  required
                  fullWidth
                  multiline
                  minRows={6}
                  slotProps={{ htmlInput: { minLength: 10, maxLength: 5000 } }}
                  helperText={`${form.message.length} / 5000`}
                />

                {/* Honeypot: off-screen and hidden from assistive tech, so only
                    bots ever fill it. A filled value is silently discarded. */}
                <TextField
                  label="Website"
                  value={form.website}
                  onChange={set('website')}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  sx={{ position: 'absolute', left: '-10000px', width: 1, height: 1 }}
                />

                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={sending}
                    startIcon={sending ? <CircularProgress size={18} /> : <SendIcon />}
                  >
                    {sending ? 'Sending…' : 'Send message'}
                  </Button>
                </Box>

                {branding.author_email && (
                  <Typography variant="caption" color="text.secondary">
                    Prefer email? Write to <SafeEmail email={branding.author_email} underline="hover" /> directly.
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>
    </SiteLayout>
  );
}
