import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TextField, Alert,
  CircularProgress, Stack,
} from '@mui/material';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

interface RateForm {
  rate_currency: string;
  rate_name: string;
  rate: string;
  last_rate: string;
  source_url: string;
}

const EMPTY: RateForm = {
  rate_currency: '',
  rate_name: '',
  rate: '',
  last_rate: '',
  source_url: '',
};

export default function RateFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<RateForm>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    getDoc(doc(db, 'rates', id!))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setForm({
            rate_currency: d.rate_currency ?? '',
            rate_name: d.rate_name ?? '',
            rate: String(d.rate ?? ''),
            last_rate: String(d.last_rate ?? ''),
            source_url: d.source_url ?? '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleChange = (field: keyof RateForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        rate_currency: form.rate_currency.toUpperCase().trim(),
        rate_name: form.rate_name.trim(),
        rate: parseFloat(form.rate) || 0,
        last_rate: parseFloat(form.last_rate) || 0,
        source_url: form.source_url.trim(),
        updated_at: serverTimestamp(),
      };

      if (isNew) {
        // status and enabled must be set explicitly. Rate.findAll filters on
        // `status == true` and getUniqueCurrencies on `enabled == true`, so a
        // rate created without them shows in this admin list but never reaches
        // the public API until a scrape happens to overwrite it.
        await addDoc(collection(db, 'rates'), {
          ...payload,
          status: true,
          enabled: true,
          status_message: '',
          rate_updated_at: serverTimestamp(),
          created_at: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'rates', id!), payload, { merge: true });
      }

      navigate('/admin/rates');
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
        {isNew ? 'Add Rate' : 'Edit Rate'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Currency Code"
              value={form.rate_currency}
              onChange={handleChange('rate_currency')}
              required
              helperText="e.g. USD, ZAR, ZWG"
              inputProps={{ style: { textTransform: 'uppercase' } }}
            />
            <TextField
              label="Source Name"
              value={form.rate_name}
              onChange={handleChange('rate_name')}
              required
              helperText="e.g. Reserve Bank of Zimbabwe"
            />
            <TextField
              label="Rate"
              type="number"
              value={form.rate}
              onChange={handleChange('rate')}
              required
              inputProps={{ step: 'any', min: 0 }}
            />
            <TextField
              label="Previous Rate"
              type="number"
              value={form.last_rate}
              onChange={handleChange('last_rate')}
              inputProps={{ step: 'any', min: 0 }}
            />
            <TextField
              label="Source URL"
              type="url"
              value={form.source_url}
              onChange={handleChange('source_url')}
            />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate('/admin/rates')}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? <CircularProgress size={20} /> : isNew ? 'Add Rate' : 'Save Changes'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
