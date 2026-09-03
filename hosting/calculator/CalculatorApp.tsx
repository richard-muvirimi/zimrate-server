import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AppBar, Box, Button, Chip, CircularProgress, Container, Divider, IconButton,
  Menu, MenuItem, Snackbar, Stack, Toolbar, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsIcon from '@mui/icons-material/Settings';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Decimal from 'decimal.js';
import { DateTime } from 'luxon';
import { groupBy } from 'lodash-es';
import RateRow from './RateRow';
import AddCustomRateDialog from './dialogs/AddCustomRateDialog';
import HiddenCurrenciesDialog from './dialogs/HiddenCurrenciesDialog';
import SettingsDialog from './dialogs/SettingsDialog';
import InstallHint from './InstallHint';
import {
  compareRates, deleteCustomRate, getRatesState, isStale, refreshRates, setHidden,
  subscribeRates, togglePin, updateCustomRate, type StoredRate,
} from './store/rates';
import { BASE_CURRENCY, LOCAL_COUNTRY_CODE, countryCode } from './currency';
import { formatAmount, formatNumber, relativeTime } from './format';
import { isStandalone } from './standalone';

/**
 * The groups the list is split into, in the order they are shown — the Android
 * app's Section enum. Local currencies the user has not favourited are surfaced
 * as suggestions rather than buried at the bottom of the full list.
 */
const SECTIONS = [
  { key: 'favourites', title: 'Favourites' },
  { key: 'suggested', title: 'Suggested' },
  { key: 'custom', title: 'Your rates' },
  { key: 'others', title: 'Other currencies' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

/** Checked before the local-currency guess, whose country lookup is meaningless
 *  for a code the user invented and would scatter custom rates into Suggested. */
function sectionOf(rate: StoredRate): SectionKey {
  if (rate.pinned || rate.currency === BASE_CURRENCY) return 'favourites';
  if (rate.custom) return 'custom';
  if (countryCode(rate.currency) === LOCAL_COUNTRY_CODE) return 'suggested';
  return 'others';
}

export default function CalculatorApp() {
  const { rates, fetchedAt, aggregate } = useSyncExternalStore(
    subscribeRates,
    getRatesState,
    getRatesState,
  );

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<'add' | 'hidden' | 'settings' | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const standalone = useMemo(() => isStandalone(), []);

  // The currency whose amount the user last typed in, and what they typed. Every
  // other row is derived from these two.
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);
  const [activeAmount, setActiveAmount] = useState('1');
  // Rates typed over the fetched ones, kept as raw text so the field stays
  // editable. In memory only — a refresh drops them, as saveApiRates does.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const visible = useMemo(() => rates.filter((rate) => !rate.hidden).sort(compareRates), [rates]);
  const hidden = useMemo(() => rates.filter((rate) => rate.hidden), [rates]);

  // Derived rather than stored, so it settles once rates arrive without any
  // setState-in-effect churn.
  //
  // Defaults to USD holding 1, as the app does — every rate is quoted per dollar,
  // so the amounts column then reads the same way the rate column does. Guessing
  // the visitor's own currency (as the site's from/to widget does) puts an
  // arbitrary row in charge and makes the two columns disagree at a glance.
  const active = useMemo(() => {
    const chosen = activeCurrency && visible.some((rate) => rate.currency === activeCurrency);
    return chosen ? activeCurrency! : BASE_CURRENCY;
  }, [activeCurrency, visible]);

  const effectiveRate = useCallback(
    (rate: StoredRate) => {
      const typed = Number(overrides[rate.currency]);
      return overrides[rate.currency] !== undefined && Number.isFinite(typed) && typed > 0
        ? typed
        : rate.rate;
    },
    [overrides],
  );

  const sourceRate = useMemo(() => {
    const source = visible.find((rate) => rate.currency === active);
    return source ? effectiveRate(source) : 1;
  }, [visible, active, effectiveRate]);

  /** target = activeAmount × targetRate ÷ sourceRate, as RatesViewModel does. */
  const amountFor = useCallback(
    (rate: StoredRate) => {
      if (rate.currency === active) return activeAmount;
      if (!sourceRate) return formatAmount(0);
      return formatAmount(
        new Decimal(Number(activeAmount) || 0).times(effectiveRate(rate)).div(sourceRate),
      );
    },
    [active, activeAmount, sourceRate, effectiveRate],
  );

  /**
   * [silent] refreshes are the ones the user did not ask for, and they fail
   * without a word — the app's "refresh quietly, never nag" rule. Opening with
   * no network would otherwise greet them with an error every time.
   */
  const refresh = useCallback(async (currency?: string, silent = false) => {
    setBusy(true);
    try {
      await refreshRates(currency);
      setOnline(true);
      // A refresh the user asked for discards what they typed, so a stale
      // override never sits on top of a fresh rate.
      setOverrides({});
      setActiveCurrency(null);
      setActiveAmount('1');
    } catch (error) {
      // A fetch that never reached the network is the most reliable offline
      // signal available: navigator.onLine reports true in a page served by the
      // service worker even when there is no connection at all.
      const offline = error instanceof TypeError;
      if (offline) setOnline(false);
      if (!silent) {
        setMessage(
          offline
            ? 'No connection — still using the rates saved on this device'
            : error instanceof Error
              ? error.message
              : 'Refresh failed',
        );
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // One refresh per launch, and only when the saved rates have aged out. It is
  // not gated on navigator.onLine for the reason above — offline, it simply
  // fails quietly and flips the indicator.
  const autoRefreshed = useRef(false);
  useEffect(() => {
    if (autoRefreshed.current) return;
    autoRefreshed.current = true;
    if (isStale()) void refresh(undefined, true);
  }, [refresh]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const grouped = useMemo(() => groupBy(visible, sectionOf), [visible]);

  const closeMenu = () => setMenuAnchor(null);

  const openDialog = (which: 'add' | 'hidden' | 'settings') => {
    closeMenu();
    setDialog(which);
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        // The standalone window paints under the iOS status bar and home
        // indicator, so the app owes itself the insets.
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <AppBar position="sticky" color="default" elevation={0} sx={{ pt: 'env(safe-area-inset-top)' }}>
        <Toolbar variant="dense">
          {/* Reached from the site in a browser tab, so there is somewhere to go
              back to. Installed, there is not — the app is the top of its own
              stack, and the menu offers the website as a deliberate departure. */}
          {!standalone && (
            <IconButton component="a" href="/" edge="start" aria-label="Back to ZimRate" sx={{ mr: 0.5 }}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
            ZimRate
          </Typography>

          {!online && (
            <Chip
              size="small"
              variant="outlined"
              icon={<CloudOffIcon />}
              label="Offline"
              sx={{ mr: 1 }}
            />
          )}

          <IconButton onClick={() => void refresh()} disabled={busy} aria-label="Refresh rates">
            {busy ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
          <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)} aria-label="Menu">
            <MoreVertIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={() => openDialog('add')}>
          <AddIcon fontSize="small" sx={{ mr: 1.5 }} /> Add your own rate
        </MenuItem>
        <MenuItem onClick={() => openDialog('hidden')} disabled={hidden.length === 0}>
          <VisibilityIcon fontSize="small" sx={{ mr: 1.5 }} /> Hidden ({hidden.length})
        </MenuItem>
        <MenuItem onClick={() => openDialog('settings')}>
          <SettingsIcon fontSize="small" sx={{ mr: 1.5 }} /> Settings
        </MenuItem>
        {/* Installed, this leaves the app, so it opens a browser tab and leaves
            the app where it was. In a tab it is an ordinary navigation. */}
        <MenuItem
          component="a"
          href="/"
          target={standalone ? '_blank' : undefined}
          rel={standalone ? 'noopener' : undefined}
          onClick={closeMenu}
        >
          <OpenInNewIcon fontSize="small" sx={{ mr: 1.5 }} /> ZimRate website
        </MenuItem>
      </Menu>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <InstallHint />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          {fetchedAt
            ? `Rates saved ${relativeTime(DateTime.fromMillis(fetchedAt).toUnixInteger())} · ${aggregate}`
            : 'No rates saved yet'}
        </Typography>

        {visible.length === 0 ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
            <Typography color="text.secondary" align="center">
              {online
                ? 'No rates saved on this device yet.'
                : 'No rates saved on this device, and you are offline.'}
            </Typography>
            {/* Always enabled: the connection may well be back by now, and the
                attempt reports what went wrong better than a dead button. */}
            <Button variant="contained" onClick={() => void refresh()} disabled={busy}>
              Fetch rates
            </Button>
          </Stack>
        ) : (
          SECTIONS.map(({ key, title }) => {
            const rows = grouped[key];
            if (!rows?.length) return null;

            return (
              <Box key={key} sx={{ mb: 3 }}>
                <Divider textAlign="left" sx={{ mb: 1.5 }}>
                  <Typography variant="overline" color="text.secondary">
                    {title}
                  </Typography>
                </Divider>

                <Stack spacing={1.5}>
                  {rows.map((rate) => (
                    <RateRow
                      key={rate.currency}
                      rate={rate}
                      rateText={overrides[rate.currency] ?? formatNumber(rate.rate)}
                      amountText={amountFor(rate)}
                      onRateChange={(value) =>
                        setOverrides((current) => ({ ...current, [rate.currency]: value }))
                      }
                      onRateCommit={() => {
                        // A custom rate has no server copy to fall back on, so the
                        // edit is committed once the field is done being typed in.
                        if (!rate.custom) return;
                        const typed = Number(overrides[rate.currency]);
                        if (Number.isFinite(typed) && typed > 0) {
                          updateCustomRate(rate.currency, typed);
                          // Drop the override so the field reads back from the
                          // store, which now holds the committed value.
                          setOverrides((current) => {
                            const next = { ...current };
                            delete next[rate.currency];
                            return next;
                          });
                        }
                      }}
                      onAmountChange={(value) => {
                        setActiveCurrency(rate.currency);
                        setActiveAmount(value);
                      }}
                      onTogglePin={() => togglePin(rate.currency)}
                      onHide={() => {
                        setHidden(rate.currency, true);
                        setMessage(`${rate.currency} hidden`);
                      }}
                      onRefresh={() => void refresh(rate.currency)}
                      onDelete={() => {
                        // Irreversible: there is no server copy of a rate the
                        // user typed in themselves.
                        if (confirm(`Delete your ${rate.currency} rate? This cannot be undone.`)) {
                          deleteCustomRate(rate.currency);
                        }
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })
        )}
      </Container>

      <AddCustomRateDialog open={dialog === 'add'} onClose={() => setDialog(null)} />
      <HiddenCurrenciesDialog
        open={dialog === 'hidden'}
        hidden={hidden}
        onClose={() => setDialog(null)}
      />
      <SettingsDialog
        open={dialog === 'settings'}
        onClose={() => setDialog(null)}
        onChanged={() => void refresh()}
      />

      <Snackbar
        open={Boolean(message)}
        autoHideDuration={4000}
        onClose={() => setMessage(null)}
        message={message}
      />
    </Box>
  );
}
