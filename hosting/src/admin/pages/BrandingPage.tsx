import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, Button, Alert,
  CircularProgress, Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebase';
import { adminFetch } from '../adminFetch';
import { BRANDING_STORAGE_KEY } from '../../branding';

interface BrandingConfig {
  app_name: string;
  tagline: string;
  author_name: string;
  author_email: string;
  author_url: string;
  repo_url: string;
  icon_version: number;
  og_version: number;
  bucket: string;
}

const EMPTY: BrandingConfig = {
  app_name: '',
  tagline: '',
  author_name: '',
  author_email: '',
  author_url: '',
  repo_url: '',
  icon_version: 0,
  og_version: 0,
  bucket: '',
};

/** Fixed paths, overwritten in place, so the public URL never changes. */
const ICON_PATH = 'branding/app-icon.png';
const OG_PATH = 'branding/og-image.png';

export default function BrandingPage() {
  const [config, setConfig] = useState<BrandingConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'icon' | 'og' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const iconInput = useRef<HTMLInputElement>(null);
  const ogInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminFetch<BrandingConfig>('/api/admin/branding')
      .then((data) => setConfig({ ...EMPTY, ...data }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const publicUrl = (path: string, version: number) =>
    config.bucket ? `https://storage.googleapis.com/${config.bucket}/${path}?v=${version}` : '';

  // The cached copy is what the public site paints from on first load, so it
  // has to be cleared or the old name lingers for returning visitors.
  const clearPublicCache = () => {
    try {
      localStorage.removeItem(BRANDING_STORAGE_KEY);
    } catch {
      // Private mode — nothing cached to clear.
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await adminFetch<BrandingConfig>('/api/admin/branding', {
        method: 'PUT',
        body: JSON.stringify({
          app_name: config.app_name,
          tagline: config.tagline,
          author_name: config.author_name,
          author_email: config.author_email,
          author_url: config.author_url,
          repo_url: config.repo_url,
        }),
      });
      setConfig({ ...EMPTY, ...updated });
      clearPublicCache();
      setSuccess('Branding saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (kind: 'icon' | 'og', file: File) => {
    setUploading(kind);
    setError('');
    setSuccess('');
    try {
      const path = kind === 'icon' ? ICON_PATH : OG_PATH;
      await uploadBytes(ref(storage, path), file, { contentType: file.type });

      // The server owns the counter so it can only move forward; bumping it is
      // what busts caches on an otherwise identical URL.
      const updated = await adminFetch<BrandingConfig>('/api/admin/branding', {
        method: 'PUT',
        body: JSON.stringify(kind === 'icon' ? { bump_icon: true } : { bump_og: true }),
      });
      setConfig({ ...EMPTY, ...updated });
      clearPublicCache();
      setSuccess(kind === 'icon' ? 'App icon updated.' : 'Social image updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box maxWidth={760}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Branding</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        The name and imagery used across the public site, the admin area and social previews.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={3}>
          <Typography variant="subtitle2" fontWeight={700}>Identity</Typography>

          <TextField
            label="App name"
            value={config.app_name}
            onChange={(e) => setConfig((c) => ({ ...c, app_name: e.target.value }))}
            fullWidth
            helperText="Replaces the wordmark, page titles and the contact email subject prefix."
          />
          <TextField
            label="Tagline"
            value={config.tagline}
            onChange={(e) => setConfig((c) => ({ ...c, tagline: e.target.value }))}
            fullWidth
          />

          <Divider />

          <Typography variant="subtitle2" fontWeight={700}>Contact</Typography>
          <Typography variant="caption" color="text.secondary">
            Shown in the footer, the FAQ, the privacy policy and as the fallback on the contact
            page. These were previously hardcoded across four files.
          </Typography>

          <TextField
            label="Author name"
            value={config.author_name}
            onChange={(e) => setConfig((c) => ({ ...c, author_name: e.target.value }))}
            fullWidth
            helperText="Used in the footer copyright line. Leave blank to omit it."
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Contact email"
              type="email"
              value={config.author_email}
              onChange={(e) => setConfig((c) => ({ ...c, author_email: e.target.value }))}
              fullWidth
              helperText="Rendered bot-obfuscated wherever it appears."
            />
            <TextField
              label="Website"
              type="url"
              value={config.author_url}
              onChange={(e) => setConfig((c) => ({ ...c, author_url: e.target.value }))}
              fullWidth
              helperText="Must start with http:// or https://"
            />
          </Stack>

          <TextField
            label="Source repository"
            type="url"
            value={config.repo_url}
            onChange={(e) => setConfig((c) => ({ ...c, repo_url: e.target.value }))}
            fullWidth
            helperText="Shown in the footer and as the “Fork me on GitHub” ribbon. Leave blank to hide both."
          />

          <Box>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Box>

          <Divider />

          <Typography variant="subtitle2" fontWeight={700}>Images</Typography>
          <Typography variant="caption" color="text.secondary">
            Each image is stored at a fixed path and replaced in place, so its URL never changes —
            that is what lets the social preview tag point at it directly.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="flex-start">
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>App icon</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Header, footer and browser tab. Square PNG, at least 512×512.
              </Typography>
              {config.icon_version > 0 && (
                <Box
                  component="img"
                  src={publicUrl(ICON_PATH, config.icon_version)}
                  alt="Current app icon"
                  sx={{ width: 56, height: 56, objectFit: 'contain', mb: 1, display: 'block' }}
                />
              )}
              <input
                ref={iconInput}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload('icon', file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => iconInput.current?.click()}
                disabled={uploading !== null}
                startIcon={uploading === 'icon' ? <CircularProgress size={16} /> : <UploadIcon />}
              >
                Upload icon
              </Button>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>Social preview</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Shown when a link is shared. 1200×630 PNG or JPEG.
              </Typography>
              {config.og_version > 0 && (
                <Box
                  component="img"
                  src={publicUrl(OG_PATH, config.og_version)}
                  alt="Current social preview"
                  sx={{ width: 160, borderRadius: 1, mb: 1, display: 'block' }}
                />
              )}
              <input
                ref={ogInput}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload('og', file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => ogInput.current?.click()}
                disabled={uploading !== null}
                startIcon={uploading === 'og' ? <CircularProgress size={16} /> : <UploadIcon />}
              >
                Upload image
              </Button>
            </Box>
          </Stack>

          <Alert severity="info" variant="outlined">
            Social previews are read by crawlers that don't run JavaScript, so the tag in
            <code> index.html</code> points at the fixed Storage URL. Upload a social image at
            least once or that preview will 404. The browser tab icon also shows the bundled
            default briefly before the configured one loads.
          </Alert>
        </Stack>
      </Paper>
    </Box>
  );
}
