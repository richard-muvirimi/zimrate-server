import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, CircularProgress,
  Alert, Tooltip, TextField, InputAdornment, MenuItem, Chip, Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import {
  deleteDoc, doc, documentId, orderBy, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCursorPage } from '../hooks/useCursorPage';
import { usePerPage } from '../hooks/usePerPage';
import { useSelection } from '../hooks/useSelection';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../components/PaginationBar';
import { DateTime, Duration } from 'luxon';
import ListFilterBar from '../components/ListFilterBar';
import FilterTextField from '../components/FilterTextField';
import type { MatchMode } from '../components/FilterTextField';
import SelectionBar from '../components/SelectionBar';

interface Rate {
  id: string;
  rate_currency: string;
  rate_name: string;
  rate: number;
  enabled?: boolean;
  probation?: boolean;
  updated_at?: { toDate: () => Date };
  source_url?: string;
}

type StateFilter = 'any' | 'enabled' | 'disabled';

const STATE_OPTIONS: { value: StateFilter; label: string }[] = [
  { value: 'any', label: 'Any state' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

/**
 * Scraping runs hourly, so a rate untouched for six hours has missed several
 * passes. Six matches the threshold the legacy status report used.
 */
const STALE_AFTER = Duration.fromObject({ hours: 6 });

/**
 * Derived from the clock on every render rather than stored on the document:
 * freshness changes with the passage of time, so a persisted flag would be
 * wrong the moment nothing wrote to it — which is exactly how the old `status`
 * field ended up permanently reading "OK".
 *
 * Display only. It is not offered as a filter because filtering would need a
 * range on updated_at, and Firestore requires the first orderBy to be the
 * inequality field — that would break the fixed rate_currency sort the
 * pagination cursors depend on.
 */
function freshness(rate: Rate): { label: string; color: 'success' | 'warning' | 'default' } {
  const updated = rate.updated_at?.toDate?.();
  if (!updated) return { label: 'Unknown', color: 'default' };
  return DateTime.fromJSDate(updated) < DateTime.now().minus(STALE_AFTER)
    ? { label: 'Stale', color: 'warning' }
    : { label: 'Fresh', color: 'success' };
}

const formatDate = (value?: Date) =>
  value ? DateTime.fromJSDate(value).toLocaleString(DateTime.DATE_SHORT) : '—';

function mapRate(d: QueryDocumentSnapshot<DocumentData>): Rate {
  return { id: d.id, ...d.data() } as Rate;
}

export default function RatesPage() {
  const { perPage, ready } = usePerPage();
  const [currency, setCurrency] = useState('');
  const [matchMode, setMatchMode] = useState<MatchMode>('prefix');
  const [state, setState] = useState<StateFilter>('any');
  const [error, setError] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const debouncedCurrency = useDebouncedValue(currency.trim().toUpperCase(), 300);

  // Sort is fixed to rate_currency so the currency box can be a range query on
  // the same field — which costs no extra index. Adding a sort selector or a
  // second simultaneous filter would multiply the composite indexes needed.
  // An exact match is the closed range [X, X], so it reuses the same index.
  const constraints = useMemo(() => {
    const parts: QueryConstraint[] = [];

    if (state === 'enabled') parts.push(where('enabled', '==', true));
    else if (state === 'disabled') parts.push(where('enabled', '==', false));

    if (debouncedCurrency) {
      parts.push(where('rate_currency', '>=', debouncedCurrency));
      if (matchMode === 'exact') parts.push(where('rate_currency', '<=', debouncedCurrency));
      else parts.push(where('rate_currency', '<', `${debouncedCurrency}`));
    }

    parts.push(orderBy('rate_currency', 'asc'));
    // Tiebreaker so cursors have a total order. Firestore appends __name__ to
    // every composite index anyway, so this is free.
    parts.push(orderBy(documentId(), 'asc'));
    return parts;
  }, [state, debouncedCurrency, matchMode]);

  const resetKey = `${state}|${debouncedCurrency}|${matchMode}`;

  const pager = useCursorPage<Rate>({
    path: 'rates',
    constraints,
    resetKey,
    perPage,
    map: mapRate,
    enabled: ready,
    withTotal: true,
  });

  const { dropLocal, reload } = pager;

  // The scraper never writes `enabled`, so a rate switched off here stays off
  // through later scrapes until it is switched back on.
  const handleToggle = useCallback(
    async (rate: Rate) => {
      try {
        await updateDoc(doc(db, 'rates', rate.id), { enabled: rate.enabled === false });
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [reload],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this rate?')) return;
      try {
        await deleteDoc(doc(db, 'rates', id));
        dropLocal((r) => r.id === id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [dropLocal],
  );

  const selection = useSelection(pager.rows.map((r) => r.id));

  const handleBulkEnabled = async (enabled: boolean) => {
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      selection.selected.forEach((id) => batch.update(doc(db, 'rates', id), { enabled }));
      await batch.commit();
      selection.clear();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selection.selected;
    if (!confirm(`Delete ${ids.length} rate(s)?`)) return;
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => batch.delete(doc(db, 'rates', id)));
      await batch.commit();
      dropLocal((r) => ids.includes(r.id));
      selection.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  const message = error || pager.error;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Rates</Typography>
        <Button component={RouterLink} to="/admin/rates/new" variant="contained" startIcon={<AddIcon />}>
          Add Rate
        </Button>
      </Box>

      {message && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{message}</Alert>}

      <ListFilterBar
        active={[
          currency.trim() && {
            label: matchMode === 'prefix' ? `Currency starts with: ${currency.trim().toUpperCase()}` : `Currency: ${currency.trim().toUpperCase()}`,
            onDelete: () => setCurrency(''),
          },
          state !== 'any' && {
            label: `State: ${STATE_OPTIONS.find((o) => o.value === state)?.label}`,
            onDelete: () => setState('any'),
          },
        ]}
        onClear={() => {
          setCurrency('');
          setMatchMode('prefix');
          setState('any');
        }}
      >
        <FilterTextField
          placeholder={matchMode === 'prefix' ? 'Currency starts with…' : 'Exact currency…'}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          matchMode={matchMode}
          onMatchModeChange={setMatchMode}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            },
          }}
          sx={{ width: { xs: '100%', sm: 260 } }}
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
                  slotProps={{ input: { 'aria-label': 'Select all rates on this page' } }}
                />
              </TableCell>
              <TableCell sx={{ width: '12%' }}>Currency</TableCell>
              <TableCell sx={{ width: '32%' }}>Name / Source</TableCell>
              <TableCell align="right" sx={{ width: '13%' }}>Rate</TableCell>
              <TableCell align="center" sx={{ width: '11%' }}>State</TableCell>
              <TableCell align="center" sx={{ width: '11%' }}>Freshness</TableCell>
              <TableCell align="right" sx={{ width: '15%', display: { xs: 'none', md: 'table-cell' } }}>
                Updated
              </TableCell>
              <TableCell align="right" sx={{ width: '1%', whiteSpace: 'nowrap' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pager.loading && pager.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {pager.rows.map((rate) => (
              <TableRow key={rate.id} hover selected={selection.isSelected(rate.id)} sx={{ opacity: pager.loading ? 0.6 : 1 }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selection.isSelected(rate.id)}
                    onChange={() => selection.toggle(rate.id)}
                    slotProps={{ input: { 'aria-label': `Select ${rate.rate_currency} ${rate.rate_name}` } }}
                  />
                </TableCell>
                <TableCell><Typography fontWeight={700}>{rate.rate_currency}</Typography></TableCell>
                <TableCell>
                  <Typography variant="body2">{rate.rate_name}</Typography>
                  {rate.source_url && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rate.source_url}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight={600}>{rate.rate?.toLocaleString()}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title={rate.enabled === false ? 'Click to serve this rate again' : 'Click to stop serving this rate'}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={rate.enabled === false ? 'Disabled' : 'Enabled'}
                      color={rate.enabled === false ? 'default' : 'success'}
                      onClick={() => handleToggle(rate)}
                    />
                  </Tooltip>
                  {rate.probation && (
                    <Tooltip title="Its source is on probation, so the API does not serve this rate yet">
                      <Chip size="small" variant="outlined" color="warning" label="Probation" sx={{ ml: 0.5 }} />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="center">
                  {(() => {
                    const { label, color } = freshness(rate);
                    return (
                      <Tooltip title={`Scraper last wrote this rate ${
                        rate.updated_at?.toDate?.()?.toLocaleString() ?? 'never'
                      }`}>
                        <Chip size="small" variant="outlined" label={label} color={color} />
                      </Tooltip>
                    );
                  })()}
                </TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(rate.updated_at?.toDate?.())}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Edit">
                    <IconButton component={RouterLink} to={`/admin/rates/${rate.id}`} size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(rate.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {!pager.loading && pager.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary" py={3}>No rates found</Typography>
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
          label="rates"
        />
      </TableContainer>
    </Box>
  );
}
