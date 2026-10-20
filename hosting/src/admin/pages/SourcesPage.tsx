import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, CircularProgress,
  Alert, Tooltip, Chip, Stack, TextField, InputAdornment, MenuItem, Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  collection, deleteDoc, doc, addDoc, documentId, onSnapshot, orderBy, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCursorPage } from '../hooks/useCursorPage';
import { usePerPage } from '../hooks/usePerPage';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useUrlSearchInput } from '../hooks/useUrlSearchInput';
import { useSelection } from '../hooks/useSelection';
import PaginationBar from '../components/PaginationBar';
import ListFilterBar from '../components/ListFilterBar';
import SelectionBar from '../components/SelectionBar';
import LinkifiedText from '../../components/LinkifiedText';

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

const FILTER_DEFAULTS = { search: '', state: '' };

function mapSource(d: QueryDocumentSnapshot<DocumentData>): Source {
  return { id: d.id, ...d.data() } as Source;
}

export default function SourcesPage() {
  const [error, setError] = useState('');
  const { perPage, ready } = usePerPage();
  const [filters, setFilters, clearFilters] = useUrlFilters(FILTER_DEFAULTS);
  const [search, setSearch] = useUrlSearchInput(
    filters.search,
    useCallback((value: string) => setFilters({ search: value }), [setFilters]),
  );
  const state = STATE_OPTIONS.find((o) => o.value === filters.state)?.value ?? 'any';
  const term = filters.search.trim().toLowerCase();
  const [scraping, setScraping] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const stopScrapes = useRef(new Map<string, () => void>());

  useEffect(() => {
    const stops = stopScrapes.current;
    return () => stops.forEach((stop) => stop());
  }, []);

  // Sorted and searched on name_lower, which every source carries — new writes
  // set it, and scripts/backfill-sources.js gave it to the ones before. Firestore
  // leaves out any document missing a field it orders or filters by, which is what
  // once made this list look empty. A missing `enabled` has always meant enabled,
  // and a missing `status` failing; the backfill wrote both down.
  const constraints = useMemo(() => {
    const parts: QueryConstraint[] = [];
    if (state === 'enabled') parts.push(where('enabled', '==', true));
    else if (state === 'disabled') parts.push(where('enabled', '==', false));
    else if (state === 'failing') parts.push(where('status', '==', false));

    if (term) {
      parts.push(where('name_lower', '>=', term), where('name_lower', '<=', `${term}`));
    }

    parts.push(orderBy('name_lower', 'asc'));
    // Tiebreaker so cursors have a total order.
    parts.push(orderBy(documentId(), 'asc'));
    return parts;
  }, [state, term]);

  const pager = useCursorPage<Source>({
    path: 'sources',
    constraints,
    resetKey: `${state}|${term}`,
    perPage,
    map: mapSource,
    enabled: ready,
    withTotal: true,
  });
  const { dropLocal, reload } = pager;

  // A disabled source is skipped by the hourly scrape and its rates leave the
  // API (within the five minutes the enabled-source list is cached); enabling
  // it again brings them back as they were.
  const handleToggle = async (source: Source) => {
    const enabled = source.enabled === false;
    try {
      await updateDoc(doc(db, 'sources', source.id), { enabled, updated_at: serverTimestamp() });
      reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this source and all the rates it has scraped?')) return;
    try {
      await deleteDoc(doc(db, 'sources', id));
      dropLocal((s) => s.id === id);
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
      // Re-read the page so the row shows the scrape's new status.
      reload();
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
            c.held ? `${c.held} held back until the next scrape confirms them` : '',
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

  const selection = useSelection(pager.rows.map((s) => s.id));
  const [bulkBusy, setBulkBusy] = useState(false);

  const handleBulkEnabled = async (enabled: boolean) => {
    const ids = selection.selected;
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => batch.update(doc(db, 'sources', id), { enabled, updated_at: serverTimestamp() }));
      await batch.commit();
      reload();
      selection.clear();
    } catch (e) {
      setError(String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selection.selected;
    if (!confirm(`Delete ${ids.length} source(s) and all the rates they have scraped?`)) return;
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => batch.delete(doc(db, 'sources', id)));
      await batch.commit();
      dropLocal((s) => ids.includes(s.id));
      selection.clear();
    } catch (e) {
      setError(String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Sources</Typography>
        <Button component={RouterLink} to="/admin/sources/new" variant="contained" startIcon={<AddIcon />}>
          Add Source
        </Button>
      </Box>

      {(error || pager.error) && (
        <Alert severity="error" sx={{ mb: 2 }}><LinkifiedText>{error || pager.error}</LinkifiedText></Alert>
      )}
      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          <LinkifiedText>{notice.text}</LinkifiedText>
        </Alert>
      )}

      <ListFilterBar
        active={[
          term && { label: `Name starts with: ${filters.search.trim()}`, onDelete: () => setFilters({ search: '' }) },
          state !== 'any' && {
            label: `State: ${STATE_OPTIONS.find((o) => o.value === state)?.label}`,
            onDelete: () => setFilters({ state: '' }),
          },
        ]}
        onClear={clearFilters}
      >
        <TextField
          placeholder="Name starts with…"
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
          onChange={(e) => setFilters({ state: e.target.value === 'any' ? '' : e.target.value })}
          size="small"
          sx={{ minWidth: 170 }}
        >
          {STATE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      </ListFilterBar>

      {pager.loading && pager.rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
      ) : (
        <>
        <SelectionBar count={selection.selected.length} onClear={selection.clear}>
          <Button size="small" variant="outlined" disabled={bulkBusy} onClick={() => handleBulkEnabled(true)}>
            Enable
          </Button>
          <Button size="small" variant="outlined" disabled={bulkBusy} onClick={() => handleBulkEnabled(false)}>
            Disable
          </Button>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} disabled={bulkBusy} onClick={handleBulkDelete}>
            Delete
          </Button>
        </SelectionBar>
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selection.allTicked}
                    indeterminate={selection.someTicked}
                    disabled={pager.rows.length === 0}
                    onChange={selection.toggleAll}
                    slotProps={{ input: { 'aria-label': 'Select all sources on this page' } }}
                  />
                </TableCell>
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
                <TableRow key={source.id} hover selected={selection.isSelected(source.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selection.isSelected(source.id)}
                      onChange={() => selection.toggle(source.id)}
                      slotProps={{ input: { 'aria-label': `Select ${source.name || source.url || 'source'}` } }}
                    />
                  </TableCell>
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
                    <Tooltip title={source.enabled === false
                      ? 'Click to scrape and serve this source again'
                      : 'Click to stop scraping this source and serving its rates'}>
                      <Chip
                        label={source.enabled === false ? 'Disabled' : 'Active'}
                        color={source.enabled === false ? 'default' : 'success'}
                        size="small"
                        variant="outlined"
                        onClick={() => handleToggle(source)}
                      />
                    </Tooltip>
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
                  <TableCell colSpan={7} align="center">
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
            loading={pager.loading}
            onFirst={pager.first}
            onPrev={pager.prev}
            onNext={pager.next}
            label="sources"
          />
        </TableContainer>
        </>
      )}
    </Box>
  );
}
