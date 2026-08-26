import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TextField, Alert,
  CircularProgress, Stack, FormControlLabel, Switch,
} from '@mui/material';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

interface SourceForm {
  name: string;
  url: string;
  enabled: boolean;
  javascript: boolean;
}

const EMPTY: SourceForm = {
  name: '',
  url: '',
  enabled: true,
  javascript: false,
};

export default function SourceFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<SourceForm>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    getDoc(doc(db, 'sources', id!))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setForm({
            name: d.name ?? '',
            url: d.url ?? '',
            enabled: d.enabled !== false,
            javascript: d.javascript === true,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleChange =
    (field: keyof SourceForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        url: form.url.trim(),
        enabled: form.enabled,
        javascript: form.javascript,
        updated_at: serverTimestamp(),
      };

      if (isNew) {
        await addDoc(collection(db, 'sources'), { ...payload, created_at: serverTimestamp() });
      } else {
        await setDoc(doc(db, 'sources', id!), payload, { merge: true });
      }

      navigate('/admin/sources');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box maxWidth={600}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {isNew ? 'Add Source' : 'Edit Source'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Source Name"
              value={form.name}
              onChange={handleChange('name')}
              required
              helperText="e.g. Reserve Bank of Zimbabwe"
            />
            <TextField
              label="URL"
              type="url"
              value={form.url}
              onChange={handleChange('url')}
              required
              helperText="The page scraped for rates"
            />
            {/* No currency field: a source can yield several currencies, so the
                currency lives on each extracted rate, not on the source. */}
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={handleChange('enabled')}
                />
              }
              label="Enabled"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.javascript}
                  onChange={handleChange('javascript')}
                />
              }
              label="Render with a browser (for pages that need JavaScript)"
            />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate('/admin/sources')}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? <CircularProgress size={20} /> : isNew ? 'Add Source' : 'Save Changes'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
