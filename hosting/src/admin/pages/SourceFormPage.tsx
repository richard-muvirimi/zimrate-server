import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TextField, Alert,
  CircularProgress, Stack, FormControlLabel, Switch, LinearProgress,
  Accordion, AccordionSummary, AccordionDetails,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  doc, getDoc, setDoc, addDoc, deleteDoc, collection, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';

interface SourceForm {
  name: string;
  url: string;
  enabled: boolean;
  javascript: boolean;
  probation: boolean;
}

/** One fetch mode tried by ScrapingService.testSource. */
interface TestAttempt {
  javascript: boolean;
  content_length: number;
  preview: string;
  rates: { currency: string; rate: number; name: string | null }[];
  error: string | null;
}

interface TestResult {
  ok: boolean;
  javascript: boolean | null;
  attempts: TestAttempt[];
  error?: string;
}

const modeLabel = (javascript: boolean) => (javascript ? 'Browser rendering' : 'Plain fetch');

const EMPTY: SourceForm = {
  name: '',
  url: '',
  enabled: true,
  javascript: false,
  // A new source proves itself before it is served; switch off to trust it now.
  probation: true,
};

export default function SourceFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<SourceForm>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [savedProbation, setSavedProbation] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ url: string; result: TestResult } | null>(null);
  const stopTest = useRef<(() => void) | null>(null);

  useEffect(() => () => stopTest.current?.(), []);

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
            probation: d.probation === true,
          });
          setSavedUrl(d.url ?? '');
          setSavedProbation(d.probation === true);
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

  // Writing a source_tests doc starts the zimrate_source_test trigger, which
  // writes the outcome back to the same doc. See functions/src/jobs/testSource.js
  // for why this is not a plain API call.
  const handleTest = async () => {
    const url = form.url.trim();
    setError('');
    setTest(null);
    setTesting(true);
    try {
      const ref = await addDoc(collection(db, 'source_tests'), { url, created_at: serverTimestamp() });

      const settle = (result: TestResult) => {
        stopTest.current?.();
        setTest({ url, result });
        if (result.ok) setForm((prev) => ({ ...prev, javascript: result.javascript === true }));
        setTesting(false);
        deleteDoc(ref).catch(() => {});
      };

      const unsubscribe = onSnapshot(ref, (snap) => {
        const d = snap.data();
        if (d?.status === 'done') {
          settle({ ok: d.ok, javascript: d.javascript, attempts: d.attempts });
        } else if (d?.status === 'failed') {
          settle({ ok: false, javascript: null, attempts: [], error: d.error });
        }
      }, (e) => {
        stopTest.current?.();
        setError(String(e));
        setTesting(false);
      });

      // The trigger is killed at 300s and leaves the doc "running", so stop
      // waiting shortly after that rather than spin forever.
      const timer = setTimeout(() => settle({
        ok: false,
        javascript: null,
        attempts: [],
        error: 'No result after 5 minutes. Check that the zimrate_source_test function is deployed, and its logs.',
      }), 330_000);

      stopTest.current = () => {
        unsubscribe();
        clearTimeout(timer);
        stopTest.current = null;
      };
    } catch (e) {
      setError(String(e));
      setTesting(false);
    }
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
        probation: form.probation,
        // Going onto probation starts the clean run from now. Its rates follow
        // the source's setting at its next scrape.
        ...(form.probation && (isNew || !savedProbation) ? { clean_since: serverTimestamp() } : {}),
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

  const url = form.url.trim();
  // A test of an earlier URL says nothing about this one.
  const shownTest = test?.url === url ? test.result : null;
  const foundRates = shownTest?.ok ? shownTest.attempts[shownTest.attempts.length - 1].rates : [];
  // Existing sources already have a scrape record for their URL, so only a new
  // or changed URL is flagged as unverified.
  const unverified = !testing && (isNew || url !== savedUrl) && !shownTest?.ok;
  const preview = shownTest?.attempts.map((a) => a.preview).filter(Boolean).pop();

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
            <Box>
              <Button variant="outlined" onClick={handleTest} disabled={!url || testing}>
                {testing ? 'Testing…' : 'Test source'}
              </Button>
              {testing && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary">
                    Fetching the page and reading its rates. This can take a minute or two,
                    longer if the page needs a browser to render.
                  </Typography>
                </Box>
              )}
              {shownTest && (
                <Box sx={{ mt: 2 }}>
                  {shownTest.ok ? (
                    <Alert severity="success">
                      Found {foundRates.length} rate(s) using{' '}
                      {modeLabel(shownTest.javascript === true).toLowerCase()}.
                      {shownTest.javascript && ' Browser rendering has been switched on under Advanced.'}
                    </Alert>
                  ) : (
                    <Alert severity="error">
                      No rates could be read from this page.
                      {shownTest.error && <Box>{shownTest.error}</Box>}
                      {shownTest.attempts.map((a) => (
                        <Box key={String(a.javascript)}>{modeLabel(a.javascript)}: {a.error}</Box>
                      ))}
                    </Alert>
                  )}
                  {shownTest.ok && (
                    <Table size="small" sx={{ mt: 1 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Currency</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell align="right">Per 1 USD</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {foundRates.map((r) => (
                          <TableRow key={`${r.currency}-${r.name}`}>
                            <TableCell>{r.currency}</TableCell>
                            <TableCell>{r.name ?? '—'}</TableCell>
                            <TableCell align="right">{r.rate}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {!shownTest.ok && preview && (
                    <Accordion variant="outlined" disableGutters sx={{ mt: 1 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2">What the scraper saw</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box
                          component="pre"
                          sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}
                        >
                          {preview}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              )}
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={handleChange('enabled')}
                />
              }
              label="Enabled"
            />
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.probation}
                    onChange={handleChange('probation')}
                  />
                }
                label="On probation"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Scraped but not served until it has gone the probation period (Options → Scraping)
                without a failed scrape or a rate refused for disagreeing with the other sources.
                Switch off to serve its rates straight away.
              </Typography>
            </Box>
            <Accordion variant="outlined" disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">Advanced</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.javascript}
                      onChange={handleChange('javascript')}
                    />
                  }
                  label="Render with a browser (for pages that need JavaScript)"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Set automatically by Test source. Browser rendering is slower and costs
                  more per scrape, so it is only switched on when a plain fetch finds no rates.
                </Typography>
              </AccordionDetails>
            </Accordion>

            {unverified && (
              <Alert severity="warning">
                {shownTest
                  ? 'This URL failed its test, so it will probably not produce rates. You can still save it.'
                  : 'This URL has not been tested. Use Test source to check it yields rates before saving.'}
              </Alert>
            )}

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
