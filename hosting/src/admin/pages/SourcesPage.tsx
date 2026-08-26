import { useEffect, useMemo, useState } from 'react';
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
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
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
    if (!confirm('Delete this source?')) return;
    try {
      await deleteDoc(doc(db, 'sources', id));
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(String(e));
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
