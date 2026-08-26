import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch } from '../adminFetch';
import { auth } from '../../firebase';
import { useArrayPage } from '../hooks/useArrayPage';
import { usePerPage } from '../hooks/usePerPage';
import { loadOptionValues, REGISTRATION_KEY } from '../options';
import PaginationBar from '../components/PaginationBar';
import ListFilterBar from '../components/ListFilterBar';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress,
  Alert, Chip, Avatar, Button, IconButton, Tooltip, Stack, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadIcon from '@mui/icons-material/Upload';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebase';

interface AdminUser {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  disabled: boolean;
  emailVerified?: boolean;
  customClaims?: Record<string, unknown>;
  // The API nests these under `metadata` (AdminController.listUsers).
  metadata?: {
    creationTime?: string;
    lastSignInTime?: string | null;
  };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', displayName: '' });

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'any' | 'admin' | 'standard' | 'disabled'>('any');
  const { perPage } = usePerPage();

  const avatarInput = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Mirrors the server-side gate so the button reflects reality instead of
  // failing on submit. The API enforces it regardless of what this says.
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  useEffect(() => {
    let active = true;
    loadOptionValues()
      .then((values) => {
        if (active) setRegistrationEnabled(values[REGISTRATION_KEY] !== 'false');
      })
      .catch(() => {
        // Unreadable options: leave the button enabled and let the API decide.
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Avatars go to a fixed per-user path so the URL is stable across replacements;
   * the version query is what makes a new upload visible.
   */
  const handleAvatar = async (target: AdminUser, file: File) => {
    setUploadingAvatar(true);
    setError('');
    try {
      const path = `avatars/${target.uid}`;
      await uploadBytes(ref(storage, path), file, { contentType: file.type });
      const url = `https://storage.googleapis.com/${storage.app.options.storageBucket}/${path}?v=${Date.now()}`;

      await adminFetch(`/api/admin/users/${target.uid}`, {
        method: 'PUT',
        body: JSON.stringify({ photoURL: url }),
      });

      setEditing((prev) => (prev ? { ...prev, photoURL: url } : prev));
      setSuccess('Photo updated.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const currentUid = auth.currentUser?.uid;

  const load = useCallback(() => {
    setLoading(true);
    // The endpoint returns a bare array, not { users: [...] }.
    adminFetch<AdminUser[]>('/api/admin/users')
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const run = async (uid: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(uid);
    setError('');
    setSuccess('');
    try {
      await fn();
      setSuccess(message);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = async () => {
    setError('');
    try {
      await adminFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      setCreateOpen(false);
      setNewUser({ email: '', password: '', displayName: '' });
      setSuccess('User created.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const target = editing;
    setEditing(null);
    await run(
      target.uid,
      () =>
        adminFetch(`/api/admin/users/${target.uid}`, {
          method: 'PUT',
          body: JSON.stringify({ displayName: editName }),
        }),
      'User updated.',
    );
  };

  const toggleDisabled = (u: AdminUser) =>
    run(
      u.uid,
      () =>
        adminFetch(`/api/admin/users/${u.uid}`, {
          method: 'PUT',
          body: JSON.stringify({ disabled: !u.disabled }),
        }),
      u.disabled ? 'User enabled.' : 'User disabled.',
    );

  const toggleAdmin = (u: AdminUser) =>
    run(
      u.uid,
      () =>
        adminFetch(`/api/admin/users/${u.uid}/claims`, {
          method: 'POST',
          body: JSON.stringify({ admin: u.customClaims?.admin !== true }),
        }),
      'Admin claim updated — that user must sign out and back in.',
    );

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    await run(
      target.uid,
      () => adminFetch(`/api/admin/users/${target.uid}`, { method: 'DELETE' }),
      'User deleted.',
    );
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      const isAdmin = u.customClaims?.admin === true;
      if (role === 'admin' && !isAdmin) return false;
      if (role === 'standard' && isAdmin) return false;
      if (role === 'disabled' && !u.disabled) return false;
      if (!term) return true;
      return (
        (u.email ?? '').toLowerCase().includes(term) ||
        (u.displayName ?? '').toLowerCase().includes(term)
      );
    });
  }, [users, search, role]);

  const pager = useArrayPage(filtered, perPage, `${search.trim()}|${role}`);
  const activeCount = (search.trim() ? 1 : 0) + (role !== 'any' ? 1 : 0);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Users</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
          <Tooltip
            title={
              registrationEnabled
                ? ''
                : 'Account registration is off. Turn it on in Options to add users.'
            }
          >
            <span>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateOpen(true)}
                disabled={!registrationEnabled}
              >
                Add user
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {!registrationEnabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Account registration is <strong>off</strong>. No new accounts can be created, including
          by other admins. Existing users can still be edited, disabled or removed. Change this
          under Options → Security.
        </Alert>
      )}

      <ListFilterBar
        activeCount={activeCount}
        onClear={() => {
          setSearch('');
          setRole('any');
        }}
      >
        <TextField
          placeholder="Search name or email…"
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
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          size="small"
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="any">Any role</MenuItem>
          <MenuItem value="admin">Admins</MenuItem>
          <MenuItem value="standard">Standard</MenuItem>
          <MenuItem value="disabled">Disabled</MenuItem>
        </TextField>
      </ListFilterBar>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Admin</TableCell>
                <TableCell align="center">Enabled</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Created</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Last sign-in</TableCell>
                <TableCell align="right" sx={{ width: '1%', whiteSpace: 'nowrap' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pager.rows.map((u) => {
                const isSelf = u.uid === currentUid;
                const isAdmin = u.customClaims?.admin === true;
                return (
                  <TableRow key={u.uid} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          src={u.photoURL ?? undefined}
                          sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}
                        >
                          {(u.displayName ?? u.email ?? '?').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {u.displayName || u.email}
                            {isSelf && <Chip label="You" size="small" sx={{ ml: 1 }} />}
                          </Typography>
                          {u.displayName && (
                            <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={u.emailVerified ? 'Verified' : 'Unverified'}
                        color={u.emailVerified ? 'success' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={isSelf ? 'You cannot change your own admin claim here' : 'Toggle admin claim'}>
                        <span>
                          <Switch
                            checked={isAdmin}
                            disabled={isSelf || busy === u.uid}
                            onChange={() => toggleAdmin(u)}
                            size="small"
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={!u.disabled}
                        disabled={isSelf || busy === u.uid}
                        onChange={() => toggleDisabled(u)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(u.metadata?.creationTime)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(u.metadata?.lastSignInTime)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit name">
                        <span>
                          <IconButton
                            size="small"
                            disabled={busy === u.uid}
                            onClick={() => { setEditing(u); setEditName(u.displayName ?? ''); }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={isSelf ? 'You cannot delete your own account' : 'Delete user'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={isSelf || busy === u.uid}
                            onClick={() => setConfirmDelete(u)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pager.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" py={3}>No users found</Typography>
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
            label="users"
          />
        </TableContainer>
      )}

      {/* Create */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add user</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Email"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Password"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
              fullWidth
              required
              helperText="At least 6 characters."
            />
            <TextField
              label="Display name (optional)"
              value={newUser.displayName}
              onChange={(e) => setNewUser((u) => ({ ...u, displayName: e.target.value }))}
              fullWidth
            />
            <FormControlLabel
              control={<Switch disabled checked={false} />}
              label="New users have no admin claim — grant it from the table afterwards."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newUser.email || newUser.password.length < 6}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit */}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Display name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
            />

            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={editing?.photoURL ?? undefined}
                sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}
              >
                {(editing?.displayName ?? editing?.email ?? '?').charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && editing) handleAvatar(editing, file);
                    e.target.value = '';
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => avatarInput.current?.click()}
                  disabled={uploadingAvatar}
                  startIcon={uploadingAvatar ? <CircularProgress size={16} /> : <UploadIcon />}
                >
                  {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Square image. Replaces the initial shown across the admin.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{confirmDelete?.displayName || confirmDelete?.email}</strong> will be permanently
            removed from Firebase Auth. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
