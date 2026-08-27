import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, CircularProgress,
  Alert, Tooltip, TextField, InputAdornment, MenuItem, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import {
  deleteDoc, doc, documentId, orderBy, where,
} from 'firebase/firestore';
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCursorPage } from '../hooks/useCursorPage';
import { usePerPage } from '../hooks/usePerPage';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../components/PaginationBar';
import ListFilterBar from '../components/ListFilterBar';

interface Rate {
  id: string;
  rate_currency: string;
  rate_name: string;
  rate: number;
  enabled?: boolean;
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
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

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
  return Date.now() - updated.getTime() > STALE_AFTER_MS
    ? { label: 'Stale', color: 'warning' }
    : { label: 'Fresh', color: 'success' };
}

function mapRate(d: QueryDocumentSnapshot<DocumentData>): Rate {
  return { id: d.id, ...d.data() } as Rate;
}

export default function RatesPage() {
  const { perPage, ready } = usePerPage();
  const [currency, setCurrency] = useState('');
  const [state, setState] = useState<StateFilter>('any');
  const [error, setError] = useState('');

  const debouncedCurrency = useDebouncedValue(currency.trim().toUpperCase(), 300);

  // Sort is fixed to rate_currency so the currency box can be a range query on
  // the same field — which costs no extra index. Adding a sort selector or a
  // second simultaneous filter would multiply the composite indexes needed.
  const constraints = useMemo(() => {
    const parts: QueryConstraint[] = [];

    if (state === 'enabled') parts.push(where('enabled', '==', true));
    else if (state === 'disabled') parts.push(where('enabled', '==', false));

    if (debouncedCurrency) {
      parts.push(where('rate_currency', '>=', debouncedCurrency));
      parts.push(where('rate_currency', '<', `${debouncedCurrency}`));
    }

    parts.push(orderBy('rate_currency', 'asc'));
    // Tiebreaker so cursors have a total order. Firestore appends __name__ to
    // every composite index anyway, so this is free.
    parts.push(orderBy(documentId(), 'asc'));
    return parts;
  }, [state, debouncedCurrency]);

  const resetKey = `${state}|${debouncedCurrency}`;

  const pager = useCursorPage<Rate>({
    path: 'rates',
    constraints,
    resetKey,
    perPage,
    map: mapRate,
    enabled: ready,
    withTotal: true,
  });

  const { dropLocal } = pager;

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

  const activeCount = (state !== 'any' ? 1 : 0) + (currency ? 1 : 0);
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
        activeCount={activeCount}
        onClear={() => {
          setCurrency('');
          setState('any');
        }}
      >
        <TextField
          placeholder="Currency starts with…"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
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

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead>
            <TableRow>
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
                <TableCell colSpan={7} align="center">
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {pager.rows.map((rate) => (
              <TableRow key={rate.id} hover sx={{ opacity: pager.loading ? 0.6 : 1 }}>
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
                  <Chip
                    size="small"
                    variant="outlined"
                    label={rate.enabled === false ? 'Disabled' : 'Enabled'}
                    color={rate.enabled === false ? 'default' : 'success'}
                  />
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
                    {rate.updated_at?.toDate?.()?.toLocaleDateString() ?? '—'}
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
                <TableCell colSpan={7} align="center">
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
