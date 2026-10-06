import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, CircularProgress,
  Alert, Tooltip, Chip, Stack, TextField, InputAdornment, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  collection, getDocs, getDoc, deleteDoc, doc, addDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useArrayPage } from '../hooks/useArrayPage';
import { usePerPage } from '../hooks/usePerPage';
import PaginationBar from '../components/PaginationBar';
import ListFilterBar from '../components/ListFilterBar';

/** Mirrors functions/src/models/Source.js — the fields the scraper actually reads. */
interface Source {
  id: string;
  name?: string;
  url?: string;
  enabled?: boolean;
  javascript?: boolean;
  status?: boolean;
  status_message?: string;
  probation?: boolean;
  clean_since?: { toDate?: () => Date } | null;
  last_scraped?: { toDate?: () => Date } | null;
}

type StateFilter = 'any' | 'enabled' | 'disabled' | 'failing';

const STATE_OPTIONS: { value: StateFilter; label: string }[] = [
  { value: 'any', label: 'Any state' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'failing', label: 'Scrape failing' },
];

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState<StateFilter>('any');
  const { perPage } = usePerPage();
  const [scraping, setScraping] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const stopScrapes = useRef(new Map<string, () => void>());

  useEffect(() => {
    const stops = stopScrapes.current;
    return () => stops.forEach((stop) => stop());
  }, []);

  const load = async () => {
    try {
      // Sorted client-side on purpose: Firestore's orderBy silently drops every
      // document missing the field, which is what made this list look empty.
      const snap = await getDocs(collection(db, 'sources'));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Source);
      rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      setSources(rows);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this source and all the rates it has scraped?')) return;
    try {
      await deleteDoc(doc(db, 'sources', id));
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(String(e));
    }
  };

  // Writing a source_scrapes doc starts the zimrate_source_scrape trigger, which
  // writes the outcome back to the same doc — the same pattern as Test source,
  // and for the same reason: Hosting cuts an API call off at 60s.
  const handleScrape = async (source: Source) => {
    const label = source.name || source.url || source.id;
    setNotice(null);
    setScraping((prev) => ({ ...prev, [source.id]: true }));

    const finish = async (severity: 'success' | 'error', text: string) => {
      stopScrapes.current.get(source.id)?.();
      setScraping((prev) => ({ ...prev, [source.id]: false }));
      setNotice({ severity, text: `${label}: ${text}` });
      try {
        const snap = await getDoc(doc(db, 'sources', source.id));
        if (snap.exists()) {
          setSources((prev) => prev.map((s) => (s.id === source.id ? { id: snap.id, ...snap.data() } as Source : s)));
        }
      } catch {
        // The row keeps its old status; the notice already says what happened.
      }
    };

    try {
      const ref = await addDoc(collection(db, 'source_scrapes'), {
        source_id: source.id,
        created_at: serverTimestamp(),
      });

      const unsubscribe = onSnapshot(ref, (snap) => {
        const d = snap.data();
        if (d?.status === 'done') {
          const c: Record<string, number> = d.counts ?? {};
          const parts = [
            `${c.updated ?? 0} updated`,
            `${c.created ?? 0} new`,
            c.merged ? `${c.merged} duplicates merged` : '',
            c.rejected ? `${c.rejected} refused as implausible` : '',
            c.conflict ? `${c.conflict} dropped as contradicted by the page` : '',
            c.promoted ? 'promoted out of probation' : '',
          ].filter(Boolean);
          finish('success', parts.join(', '));
          deleteDoc(ref).catch(() => {});
        } else if (d?.status === 'failed') {
          finish('error', d.error ?? 'Scrape failed');
          deleteDoc(ref).catch(() => {});
        }
      }, (e) => finish('error', String(e)));

      // The trigger is killed at 300s and leaves the doc "running".
      const timer = setTimeout(() => finish(
        'error',
        'No result after 5 minutes. Check that the zimrate_source_scrape function is deployed, and its logs.',
      ), 330_000);

      stopScrapes.current.set(source.id, () => {
        unsubscribe();
        clearTimeout(timer);
        stopScrapes.current.delete(source.id);
      });
    } catch (e) {
      finish('error', String(e));
    }
  };

  // Filtering client-side is legitimate here: the whole collection is already
  // in memory (tens of rows), and it avoids Firestore orderBy, which silently
  // drops documents missing the sorted field.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sources.filter((s) => {
      if (state === 'enabled' && s.enabled === false) return false;
      if (state === 'disabled' && s.enabled !== false) return false;
      if (state === 'failing' && s.status) return false;
      if (!term) return true;
      return (
        (s.name ?? '').toLowerCase().includes(term) ||
        (s.url ?? '').toLowerCase().includes(term)
      );
    });
  }, [sources, search, state]);

  const pager = useArrayPage(filtered, perPage, `${search.trim()}|${state}`);
  const activeCount = (search.trim() ? 1 : 0) + (state !== 'any' ? 1 : 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Sources</Typography>
        <Button component={RouterLink} to="/admin/sources/new" variant="contained" startIcon={<AddIcon />}>
          Add Source
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <ListFilterBar
        activeCount={activeCount}
        onClear={() => {
          setSearch('');
          setState('any');
        }}
      >
        <TextField
          placeholder="Search name or URL…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            },
          }}
          sx={{ width: { xs: '100%', sm: 280 } }}
        />
        <TextField
          select
          value={state}
          onChange={(e) => setState(e.target.value as StateFilter)}
          size="small"
          sx={{ minWidth: 170 }}
        >
          {STATE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      </ListFilterBar>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '24%' }}>Name</TableCell>
                <TableCell sx={{ width: '34%' }}>URL</TableCell>
                <TableCell align="center" sx={{ width: '12%' }}>Enabled</TableCell>
                <TableCell align="center" sx={{ width: '12%' }}>Last scrape</TableCell>
                <TableCell sx={{ width: '18%', display: { xs: 'none', md: 'table-cell' } }}>
                  Rendering
                </TableCell>
                <TableCell align="right" sx={{ width: '1%', whiteSpace: 'nowrap' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pager.rows.map((source) => (
                <TableRow key={source.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{source.name || '(unnamed)'}</Typography>
                  </TableCell>
                  <TableCell>
                    {source.url ? (
                      <Typography
                        variant="caption"
                        color="primary"
                        component="a"
                        href={source.url}
                        target="_blank"
                        rel="noopener"
                        sx={{
                          textDecoration: 'none',
                          display: 'block',
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {source.url}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="error">No URL set</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={source.enabled === false ? 'Disabled' : 'Active'}
                      color={source.enabled === false ? 'default' : 'success'}
                      size="small"
                      variant="outlined"
                    />
                    {source.probation && (
                      <Tooltip title={`Scraped but not served until it has a clean record for the probation period. Clean since ${
                        source.clean_since?.toDate?.()?.toLocaleString() ?? 'its next scrape'
                      }.`}>
                        <Chip label="Probation" color="warning" size="small" variant="outlined" sx={{ ml: 0.5 }} />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={source.status_message || (source.status ? 'Last scrape succeeded' : 'No successful scrape recorded')}>
                      <Chip
                        label={source.status ? 'OK' : 'Failed'}
                        color={source.status ? 'success' : 'warning'}
                        size="small"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Typography variant="caption" color="text.secondary">
                      {source.javascript ? 'Browser (JS)' : 'Static HTML'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Stack direction="row" justifyContent="flex-end">
                      <Tooltip title={source.enabled === false ? 'Enable the source to scrape it' : 'Scrape now'}>
                        {/* A span so the tooltip still shows on a disabled button */}
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleScrape(source)}
                            disabled={scraping[source.id] || source.enabled === false || !source.url}
                          >
                            {scraping[source.id]
                              ? <CircularProgress size={18} />
                              : <RefreshIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton component={RouterLink} to={`/admin/sources/${source.id}`} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(source.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {pager.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" py={3}>No sources found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <PaginationBar
            page={pager.page}
            rangeStart={pager.rangeStart}
            rangeEnd={pager.rangeEnd}
            total={pager.total}
            hasPrev={pager.hasPrev}
            hasNext={pager.hasNext}
            onFirst={pager.first}
            onPrev={pager.prev}
            onNext={pager.next}
            label="sources"
          />
        </TableContainer>
      )}
    </Box>
  );
}
