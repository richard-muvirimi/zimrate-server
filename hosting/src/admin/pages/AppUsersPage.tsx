import { useState } from 'react';
import {
  Alert, Avatar, Box, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { DateTime } from 'luxon';
import { adminFetch } from '../adminFetch';
import { useTokenPage } from '../hooks/useTokenPage';
import { usePerPage } from '../hooks/usePerPage';
import PaginationBar from '../components/PaginationBar';

interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  anonymous: boolean;
  disabled: boolean;
  admin: boolean;
  creationTime?: string;
  lastSignInTime?: string | null;
  balance: number;
}

interface Grant {
  key: string;
  amount?: number;
  balance?: number;
  type?: string;
  description?: string;
  createdAt?: number;
  expiresAt?: number;
}

interface Wallet {
  rewards: Grant[];
  spends: Grant[];
  outstanding: number;
}

/** Firebase reports these as HTTP-date strings, which fromISO cannot read. */
function formatDate(value?: string | null) {
  if (!value) return '—';
  const http = DateTime.fromHTTP(value);
  const parsed = http.isValid ? http : DateTime.fromISO(value);
  return parsed.isValid ? parsed.toLocaleString(DateTime.DATE_SHORT) : '—';
}

function formatStamp(seconds?: number) {
  if (!seconds) return '—';
  return DateTime.fromSeconds(seconds).toLocaleString(DateTime.DATE_SHORT);
}

/**
 * The people using the app, as opposed to the people running it.
 *
 * Separate from the Users page because they are separate populations that merely
 * share a user store: every install creates an auth account, so this list grows
 * with the install base while the console roster stays a handful of people.
 *
 * Paged against the API rather than filtered in the browser, for the same reason.
 */
export default function AppUsersPage() {
  const { perPage, ready } = usePerPage();
  const pager = useTokenPage<AppUser>({
    path: '/api/admin/app-users',
    perPage,
    enabled: ready,
  });

  const [wallet, setWallet] = useState<{ user: AppUser; data: Wallet | null } | null>(null);
  const [walletError, setWalletError] = useState('');

  const openWallet = async (user: AppUser) => {
    setWallet({ user, data: null });
    setWalletError('');
    try {
      setWallet({ user, data: await adminFetch<Wallet>(`/api/admin/app-users/${user.uid}/wallet`) });
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>App users</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={pager.reload}><RefreshIcon /></IconButton>
        </Tooltip>
      </Stack>

      {pager.error && <Alert severity="error" sx={{ mb: 2 }}>{pager.error}</Alert>}

      {pager.loading && pager.rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Sign-in</TableCell>
                <TableCell align="right">Coins</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Joined</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Last seen</TableCell>
                <TableCell align="right" sx={{ width: '1%' }}>Wallet</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pager.rows.map((u) => (
                <TableRow key={u.uid} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                        {(u.displayName ?? u.email ?? '?').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {u.displayName || u.email || 'Anonymous'}
                          {u.admin && <Chip label="Admin" size="small" sx={{ ml: 1 }} />}
                          {u.disabled && (
                            <Chip label="Disabled" size="small" color="warning" sx={{ ml: 1 }} />
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{u.uid}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      title={
                        u.anonymous
                          ? 'No provider — this account cannot be signed back into from another device'
                          : ''
                      }
                    >
                      <Chip
                        label={u.anonymous ? 'Anonymous' : 'Linked'}
                        size="small"
                        variant="outlined"
                        color={u.anonymous ? 'default' : 'success'}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      // Negative is legitimate: two handsets drawing on one grant.
                      color={u.balance < 0 ? 'warning.main' : 'text.primary'}
                    >
                      {u.balance}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(u.creationTime)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(u.lastSignInTime)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Coin history">
                      <IconButton size="small" onClick={() => openWallet(u)}>
                        <ReceiptLongIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {pager.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" py={4}>No app users yet</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <PaginationBar
        page={pager.page}
        rangeStart={pager.rangeStart}
        rangeEnd={pager.rangeEnd}
        // Auth only offers a forward token, so there is no count to show.
        total={null}
        hasPrev={pager.hasPrev}
        hasNext={pager.hasNext}
        loading={pager.loading}
        onFirst={pager.first}
        onPrev={pager.prev}
        onNext={pager.next}
        label="app users"
      />

      <Dialog open={wallet !== null} onClose={() => setWallet(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {wallet?.user.displayName || wallet?.user.email || wallet?.user.uid}
          <Typography variant="body2" color="text.secondary">
            {wallet?.data ? `${wallet.data.outstanding} coins available` : 'Loading…'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {walletError && <Alert severity="error" sx={{ mb: 2 }}>{walletError}</Alert>}
          {wallet?.data === null && !walletError && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          )}
          {wallet?.data && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Grants</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Left</TableCell>
                      <TableCell align="right">Expires</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {wallet.data.rewards.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell>{r.type ?? '—'}</TableCell>
                        <TableCell>{r.description ?? '—'}</TableCell>
                        <TableCell align="right">{r.amount ?? 0}</TableCell>
                        <TableCell align="right">{r.balance ?? 0}</TableCell>
                        <TableCell align="right">{formatStamp(r.expiresAt)}</TableCell>
                      </TableRow>
                    ))}
                    {wallet.data.rewards.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography color="text.secondary" py={2}>No grants</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Spends</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">When</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {wallet.data.spends.map((s) => (
                      <TableRow key={s.key}>
                        <TableCell>{s.type ?? '—'}</TableCell>
                        <TableCell>{s.description ?? '—'}</TableCell>
                        <TableCell align="right">{s.amount ?? 0}</TableCell>
                        <TableCell align="right">{formatStamp(s.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {wallet.data.spends.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="text.secondary" py={2}>No spends</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
