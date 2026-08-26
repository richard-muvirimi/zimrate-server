import { useState } from 'react';
import {
  Box, Typography, Paper, Button, Stack, Alert,
  CircularProgress, Divider, TextField,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { adminFetch } from '../adminFetch';

export default function ImportExportPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importJson, setImportJson] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const data = await adminFetch<unknown>('/api/admin/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zimrate-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Export downloaded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importJson.trim()) { setError('Paste JSON to import first.'); return; }
    setImporting(true);
    setError('');
    try {
      // The endpoint only accepts a top-level array — catch that here rather
      // than surfacing a raw 400.
      if (!Array.isArray(JSON.parse(importJson))) {
        throw new Error('Import data must be a JSON array of rate rows.');
      }
      const result = await adminFetch<{ count?: number }>('/api/admin/import', {
        method: 'POST',
        body: importJson,
      });
      setSuccess(`Imported ${result.count ?? '?'} records.`);
      setImportJson('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box maxWidth={700}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Import / Export</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Stack spacing={3}>
        {/* Export */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Export Rates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Download all current rates as a JSON file for backup or migration.
          </Typography>
          <Button
            variant="outlined"
            startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export JSON'}
          </Button>
        </Paper>

        <Divider />

        {/* Import */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Import Rates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paste a previously exported JSON to bulk-import rates. Existing records with the same currency will be updated.
          </Typography>
          <TextField
            multiline
            rows={8}
            fullWidth
            placeholder='Paste JSON here...'
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            sx={{ mb: 2, fontFamily: 'monospace' }}
          />
          <Button
            variant="contained"
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Importing…' : 'Import JSON'}
          </Button>
        </Paper>
      </Stack>
    </Box>
  );
}
