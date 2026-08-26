import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, MenuItem, Button,
  CircularProgress, Alert, Divider, Switch, FormControlLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  KNOWN_OPTIONS,
  OPTION_GROUPS,
  PER_PAGE_KEY,
  PER_PAGE_CHOICES,
  PER_PAGE_STORAGE_KEY,
  findOptionDef,
  invalidateOptions,
  loadOptions,
  type OptionDef,
  type OptionGroup,
} from '../options';

interface Row extends OptionDef {
  /** Absent until the option has been written to Firestore at least once. */
  docId?: string;
  value: string;
  /** True for keys found in Firestore that aren't in the registry. */
  unknown?: boolean;
}

const OTHER: OptionGroup | 'Other' = 'Other';

export default function OptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savedOnce, setSavedOnce] = useState(false);
  const [error, setError] = useState('');

  // Autosave writes whatever differs from the last persisted value. Rows live
  // in a ref so the effect keys off the debounced edits alone, and the ref is
  // synced in an effect because mutating one during render is not allowed.
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  });

  useEffect(() => {
    loadOptions()
      .then((stored) => {
        const byKey = new Map(stored.map((o) => [o.key, o]));

        // Every registry key is rendered whether or not a document exists —
        // that is what makes an unwritten option (e.g. scraping_enabled)
        // reachable for the first time.
        const known: Row[] = KNOWN_OPTIONS.map((def) => {
          const hit = byKey.get(def.key);
          return { ...def, docId: hit?.id, value: hit?.value ?? def.fallback };
        });

        // Anything in Firestore we don't know about stays editable rather than
        // silently disappearing from the UI.
        const extras: Row[] = stored
          .filter((o) => !findOptionDef(o.key))
          .map((o) => ({
            key: o.key,
            label: o.key.replace(/_/g, ' '),
            description:
              'No code in this app reads this setting, so changing it has no effect. It is most '
              + 'likely left over from an older version. Shown here so you can review or remove it.',
            group: 'General',
            type: 'text',
            fallback: '',
            docId: o.id,
            value: o.value,
            unknown: true,
          }));

        const all = [...known, ...extras];
        setRows(all);
        setEdited(Object.fromEntries(all.map((r) => [r.key, r.value])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, value: string) =>
    setEdited((prev) => ({ ...prev, [key]: value }));

  /** Only offered for unrecognised keys — registry options must stay editable. */
  const handleRemove = async (row: Row) => {
    if (!row.docId || !row.unknown) return;
    if (!confirm(`Delete the "${row.key}" option? Nothing in the app reads it.`)) return;

    try {
      await deleteDoc(doc(db, 'options', row.docId));
      invalidateOptions();
      setRows((prev) => prev.filter((r) => r.key !== row.key));
      setEdited((prev) => {
        const next = { ...prev };
        delete next[row.key];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Text fields would otherwise write per keystroke; switches and selects still
  // feel immediate at this delay.
  const debouncedEdited = useDebouncedValue(edited, 700);

  useEffect(() => {
    const current = rowsRef.current;
    if (current.length === 0) return;

    // Only what actually changed is written — never the whole set.
    const dirty = current.filter((r) => debouncedEdited[r.key] !== r.value);
    if (dirty.length === 0) return;

    let active = true;

    Promise.all(
      dirty.map((row) => {
        const value = debouncedEdited[row.key];
        if (row.docId) {
          return setDoc(
            doc(db, 'options', row.docId),
            { key: row.key, value, updated_at: serverTimestamp() },
            { merge: true },
          );
        }
        // Creating on first write is what makes an option that was never
        // seeded reachable at all.
        return addDoc(collection(db, 'options'), {
          key: row.key,
          value,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }),
    )
      .then(async () => {
        // Keep the per-page mirror in step so lists pick the change up at once.
        const perPage = debouncedEdited[PER_PAGE_KEY];
        if (perPage) {
          try {
            localStorage.setItem(PER_PAGE_STORAGE_KEY, perPage);
          } catch {
            // Private mode — the Firestore value still wins on next load.
          }
        }

        invalidateOptions();
        const reloaded = await loadOptions();
        if (!active) return;

        const byKey = new Map(reloaded.map((o) => [o.key, o]));
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            docId: byKey.get(r.key)?.id ?? r.docId,
            value: debouncedEdited[r.key] ?? r.value,
          })),
        );
        setSavedOnce(true);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      active = false;
    };
  }, [debouncedEdited]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  // Derived rather than stored, so no setState runs inside the save effect.
  const pending = rows.some((r) => edited[r.key] !== r.value);
  const status: 'idle' | 'saving' | 'saved' = pending
    ? 'saving'
    : savedOnce
      ? 'saved'
      : 'idle';

  const groups: (OptionGroup | typeof OTHER)[] = [
    ...OPTION_GROUPS,
    ...(rows.some((r) => r.unknown) ? [OTHER] : []),
  ];

  const renderControl = (row: Row) => {
    const value = edited[row.key] ?? '';

    if (row.type === 'boolean') {
      return (
        <FormControlLabel
          control={
            <Switch
              checked={value === 'true'}
              onChange={(e) => set(row.key, e.target.checked ? 'true' : 'false')}
            />
          }
          label={value === 'true' ? 'On' : 'Off'}
        />
      );
    }

    if (row.key === PER_PAGE_KEY) {
      return (
        <TextField
          select
          value={value}
          onChange={(e) => set(row.key, e.target.value)}
          size="small"
          sx={{ minWidth: 140 }}
        >
          {PER_PAGE_CHOICES.map((n) => (
            <MenuItem key={n} value={String(n)}>{n} per page</MenuItem>
          ))}
        </TextField>
      );
    }

    return (
      <TextField
        value={value}
        onChange={(e) => set(row.key, e.target.value)}
        fullWidth
        size="small"
        multiline={row.type === 'longtext'}
        minRows={row.type === 'longtext' ? 2 : undefined}
        type={row.type === 'number' ? 'number' : 'text'}
      />
    );
  };

  return (
    <Box maxWidth={780}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="h5" fontWeight={700}>Options</Typography>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minHeight: 24 }}>
          {status === 'saving' && (
            <>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">Saving…</Typography>
            </>
          )}
          {status === 'saved' && (
            <>
              <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">Saved</Typography>
            </>
          )}
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Settings that change how the API and scraper behave without a redeploy. Changes save
        automatically.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack spacing={3}>
        {groups.map((group) => {
          const inGroup = rows.filter((r) =>
            group === OTHER ? r.unknown : !r.unknown && r.group === group,
          );
          if (inGroup.length === 0) return null;

          return (
            <Paper key={group} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                {group}
              </Typography>
              <Divider sx={{ mb: 2.5 }} />

              <Stack spacing={3}>
                {inGroup.map((row) => (
                  <Box key={row.key}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                      {row.label}
                      {!row.docId && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          (not set — using default)
                        </Typography>
                      )}
                    </Typography>
                    {row.unknown && (
                      <Button size="small" color="error" onClick={() => handleRemove(row)}>
                        Remove
                      </Button>
                    )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      {row.description}
                    </Typography>
                    {renderControl(row)}
                  </Box>
                ))}
              </Stack>
            </Paper>
          );
        })}
      </Stack>

    </Box>
  );
}
