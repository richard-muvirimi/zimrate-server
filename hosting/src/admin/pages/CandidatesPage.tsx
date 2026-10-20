import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, CircularProgress, Alert, Chip, Stack, TextField, MenuItem, Link,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox,
} from '@mui/material';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import {
  collection, doc, addDoc, deleteDoc, documentId, onSnapshot, orderBy, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCursorPage } from '../hooks/useCursorPage';
import { usePerPage } from '../hooks/usePerPage';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useSelection } from '../hooks/useSelection';
import PaginationBar from '../components/PaginationBar';
import ListFilterBar from '../components/ListFilterBar';
import SelectionBar from '../components/SelectionBar';
import LinkifiedText from '../../components/LinkifiedText';

/** Mirrors what functions/src/services/DiscoveryService.js writes. */
interface Candidate {
  id: string;
  url: string;
  domain?: string;
  title?: string;
  query?: string;
  status: 'new' | 'testing' | 'passed' | 'failed' | 'approved' | 'rejected';
  error?: string | null;
  javascript?: boolean | null;
  page_date?: string | null;
  rates?: { currency: string; name: string | null; rate: number; refused: boolean }[];
  found_at?: { toDate?: () => Date } | null;
  tested_at?: { toMillis?: () => number } | null;
}

type View = 'review' | 'approved' | 'rejected' | 'all';

const VIEWS: { value: View; label: string }[] = [
  { value: 'review', label: 'Awaiting review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS: Record<Candidate['status'], { label: string; color: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  new: { label: 'Queued', color: 'default' },
  testing: { label: 'Testing…', color: 'info' },
  passed: { label: 'Passed', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'default' },
};

/** A source name from a page title: the site part of "Rates | Site", else the domain. */
function suggestName(c: Candidate): string {
  const parts = (c.title ?? '').split(/\s[|–—-]\s/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : (c.domain ?? c.url);
}

/** Identifies one test of a candidate, so a retest request can tell when it has been picked up. */
const testStamp = (c: Candidate) => c.tested_at?.toMillis?.() ?? 0;

function summary(c: Candidate): string {
  const rates = c.rates ?? [];
  if (rates.length === 0) return '';
  const zwg = rates.filter((r) => r.currency === 'ZWG' && !r.refused).map((r) => r.rate);
  const refused = rates.filter((r) => r.refused).length;
  return [
    `${rates.length} rate(s)`,
    zwg.length ? `ZWG ${Math.min(...zwg)}–${Math.max(...zwg)}` : '',
    refused ? `${refused} refused` : '',
  ].filter(Boolean).join(' · ');
}

const FILTER_DEFAULTS = { view: '' };

/** Every status short of a decision. */
const AWAITING_REVIEW: Candidate['status'][] = ['new', 'testing', 'passed', 'failed'];

function mapCandidate(d: QueryDocumentSnapshot<DocumentData>): Candidate {
  return { id: d.id, ...d.data() } as Candidate;
}

export default function CandidatesPage() {
  const [error, setError] = useState('');
  const [filters, setFilters] = useUrlFilters(FILTER_DEFAULTS);
  const view = VIEWS.find((v) => v.value === filters.view)?.value ?? 'review';
  const setView = (next: View) => setFilters({ view: next === 'review' ? '' : next });
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [approving, setApproving] = useState<{ candidate: Candidate; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // Candidate id → the test it had when Retest was clicked. Pending until the
  // trigger marks it testing or writes a newer test.
  const [retests, setRetests] = useState<Record<string, number>>({});
  const stopRun = useRef<(() => void) | null>(null);
  const { perPage, ready } = usePerPage();

  useEffect(() => () => stopRun.current?.(), []);

  // found_at is set when discovery files a candidate, so ordering on it leaves none out.
  const constraints = useMemo(() => {
    const parts: QueryConstraint[] = [];
    if (view === 'review') parts.push(where('status', 'in', AWAITING_REVIEW));
    else if (view !== 'all') parts.push(where('status', '==', view));
    parts.push(orderBy('found_at', 'desc'));
    // Tiebreaker so cursors have a total order.
    parts.push(orderBy(documentId(), 'desc'));
    return parts;
  }, [view]);

  // Live, so a candidate moves from Testing to Passed or Failed on screen.
  const pager = useCursorPage<Candidate>({
    path: 'source_candidates',
    constraints,
    resetKey: view,
    perPage,
    map: mapCandidate,
    enabled: ready,
    withTotal: true,
    live: true,
  });

  // Pending until the trigger marks it testing or writes a newer test.
  const isQueued = (c: Candidate) => c.id in retests && c.status !== 'testing' && retests[c.id] === testStamp(c);
  const isReviewable = (c: Candidate) => !isQueued(c) && (c.status === 'passed' || c.status === 'failed');

  // Only reviewable rows can be ticked: the bulk actions are the per-row
  // Retest and Reject, which are disabled on every other row.
  const selection = useSelection(pager.rows.filter(isReviewable).map((c) => c.id));
  const [bulkBusy, setBulkBusy] = useState(false);

  const handleBulkReject = async () => {
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      selection.selected.forEach((id) => batch.update(doc(db, 'source_candidates', id), {
        status: 'rejected',
        reviewed_at: serverTimestamp(),
      }));
      await batch.commit();
      selection.clear();
    } catch (e) {
      setError(String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkRetest = async () => {
    const picked = pager.rows.filter((c) => selection.selected.includes(c.id));
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      picked.forEach((c) => batch.set(doc(collection(db, 'candidate_retests')), {
        candidate_id: c.id,
        created_at: serverTimestamp(),
      }));
      await batch.commit();
      setRetests((prev) => ({ ...prev, ...Object.fromEntries(picked.map((c) => [c.id, testStamp(c)])) }));
      selection.clear();
    } catch (e) {
      setError(String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  // Writing a discovery_runs doc starts the zimrate_discover_request trigger,
  // the same pattern as Test source, because Hosting cuts API calls off at 60s.
  const handleDiscover = async () => {
    setNotice(null);
    setDiscovering(true);

    const finish = (severity: 'success' | 'error', text: string) => {
      stopRun.current?.();
      setDiscovering(false);
      setNotice({ severity, text });
    };

    try {
      const ref = await addDoc(collection(db, 'discovery_runs'), { created_at: serverTimestamp() });

      const unsubscribe = onSnapshot(ref, (snap) => {
        const d = snap.data();
        if (d?.status === 'done') {
          finish('success', `Searched ${d.results} result(s) and added ${d.added} new candidate(s). `
            + (d.added ? 'Each is being tested now.' : ''));
          deleteDoc(ref).catch(() => {});
        } else if (d?.status === 'failed') {
          finish('error', d.error ?? 'Discovery failed');
          deleteDoc(ref).catch(() => {});
        }
      }, (e) => finish('error', String(e)));

      const timer = setTimeout(() => finish(
        'error',
        'No result after 5 minutes. Check that the zimrate_discover_request function is deployed, and its logs.',
      ), 330_000);

      stopRun.current = () => {
        unsubscribe();
        clearTimeout(timer);
        stopRun.current = null;
      };
    } catch (e) {
      finish('error', String(e));
    }
  };

  // The source starts on probation: scraped, but not served until it has
  // gone the probation period without a refused rate or a failed scrape.
  const handleApprove = async () => {
    if (!approving) return;
    const { candidate, name } = approving;
    setSaving(true);
    try {
      const sourceRef = doc(collection(db, 'sources'));
      const batch = writeBatch(db);
      batch.set(sourceRef, {
        name: name.trim(),
        // The Sources list sorts and filters on these; see models/Source.js.
        name_lower: name.trim().toLowerCase(),
        status: false,
        url: candidate.url,
        enabled: true,
        javascript: candidate.javascript === true,
        probation: true,
        clean_since: serverTimestamp(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      batch.update(doc(db, 'source_candidates', candidate.id), {
        status: 'approved',
        source_id: sourceRef.id,
        reviewed_at: serverTimestamp(),
      });
      await batch.commit();
      setApproving(null);
      setNotice({ severity: 'success', text: `${name.trim()} added as a source on probation.` });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  // Writing a candidate_retests doc starts the zimrate_candidate_retest
  // trigger, which vets the candidate again; this row updates live as it does.
  const handleRetest = async (candidate: Candidate) => {
    try {
      await addDoc(collection(db, 'candidate_retests'), {
        candidate_id: candidate.id,
        created_at: serverTimestamp(),
      });
      setRetests((prev) => ({ ...prev, [candidate.id]: testStamp(candidate) }));
    } catch (e) {
      setError(String(e));
    }
  };

  const handleReject = async (candidate: Candidate) => {
    try {
      await updateDoc(doc(db, 'source_candidates', candidate.id), {
        status: 'rejected',
        reviewed_at: serverTimestamp(),
      });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={700}>Candidates</Typography>
        <Button
          variant="contained"
          startIcon={discovering ? <CircularProgress size={18} color="inherit" /> : <TravelExploreIcon />}
          onClick={handleDiscover}
          disabled={discovering}
        >
          {discovering ? 'Searching…' : 'Run discovery now'}
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Pages found by searching Google, each tested before it is listed here. An approved candidate
        becomes a source on probation: scraped, but not served until it has a clean record. A rejected
        one is never proposed again. Searches and the weekly schedule are under Options → Discovery.
      </Typography>

      {(error || pager.error) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}><LinkifiedText>{error || pager.error}</LinkifiedText></Alert>
      )}
      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}><LinkifiedText>{notice.text}</LinkifiedText></Alert>
      )}

      <ListFilterBar
        active={[
          view !== 'review' && {
            label: `Showing: ${VIEWS.find((v) => v.value === view)?.label}`,
            onDelete: () => setView('review'),
          },
        ]}
        onClear={() => setView('review')}
      >
        <TextField select value={view} onChange={(e) => setView(e.target.value as View)} size="small" sx={{ minWidth: 190 }}>
          {VIEWS.map((v) => <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>)}
        </TextField>
      </ListFilterBar>

      {pager.loading && pager.rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
      ) : (
        <>
        <SelectionBar count={selection.selected.length} onClear={selection.clear}>
          <Button size="small" variant="outlined" disabled={bulkBusy} onClick={handleBulkRetest}>
            Retest
          </Button>
          <Button size="small" variant="outlined" disabled={bulkBusy} onClick={handleBulkReject}>
            Reject
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
                    disabled={!pager.rows.some(isReviewable)}
                    onChange={selection.toggleAll}
                    slotProps={{ input: { 'aria-label': 'Select all reviewable candidates on this page' } }}
                  />
                </TableCell>
                <TableCell sx={{ width: '38%' }}>Page</TableCell>
                <TableCell align="center" sx={{ width: '10%' }}>Test</TableCell>
                <TableCell sx={{ width: '36%' }}>Findings</TableCell>
                <TableCell align="right" sx={{ width: '1%', whiteSpace: 'nowrap' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pager.rows.map((c) => {
                const queued = isQueued(c);
                const status = queued ? STATUS.new : (STATUS[c.status] ?? STATUS.new);
                const reviewable = isReviewable(c);
                return (
                  <TableRow key={c.id} hover selected={selection.isSelected(c.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selection.isSelected(c.id)}
                        disabled={!reviewable}
                        onChange={() => selection.toggle(c.id)}
                        slotProps={{ input: { 'aria-label': `Select ${c.title || c.domain || c.url}` } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600} sx={{ wordBreak: 'break-word' }}>{c.title || c.domain}</Typography>
                      <Link
                        href={c.url}
                        target="_blank"
                        rel="noopener"
                        variant="caption"
                        sx={{ display: 'block', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {c.url}
                      </Link>
                      {c.query && (
                        <Typography variant="caption" color="text.secondary">Found by “{c.query}”</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={status.label} color={status.color} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {summary(c) && <Typography variant="body2">{summary(c)}</Typography>}
                      {c.page_date && (
                        <Typography variant="caption" color="text.secondary" display="block">Page dated {c.page_date}</Typography>
                      )}
                      {c.error && (
                        <Typography variant="caption" color="error" display="block"><LinkifiedText>{c.error}</LinkifiedText></Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!reviewable}
                          onClick={() => setApproving({ candidate: c, name: suggestName(c) })}
                        >
                          Approve
                        </Button>
                        <Button size="small" color="inherit" disabled={!reviewable} onClick={() => handleRetest(c)}>
                          {queued ? 'Queued…' : 'Retest'}
                        </Button>
                        <Button size="small" color="inherit" disabled={!reviewable} onClick={() => handleReject(c)}>
                          Reject
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pager.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" py={3}>
                      {view === 'review' ? 'Nothing awaiting review' : 'No candidates'}
                    </Typography>
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
            label="candidates"
          />
        </TableContainer>
        </>
      )}

      <Dialog open={approving !== null} onClose={() => !saving && setApproving(null)} fullWidth maxWidth="sm">
        <DialogTitle>Add as a source on probation</DialogTitle>
        <DialogContent>
          {approving?.candidate.status === 'failed' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This page failed its test: {approving.candidate.error}
            </Alert>
          )}
          <TextField
            label="Source name"
            value={approving?.name ?? ''}
            onChange={(e) => setApproving((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
            fullWidth
            sx={{ mt: 1 }}
            helperText="Prefixed to every rate name from this source, e.g. “CABS - Buy”"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproving(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleApprove} disabled={saving || !approving?.name.trim()}>
            {saving ? <CircularProgress size={20} /> : 'Add source'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
