import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { DateTime } from 'luxon';
import { adminFetch } from '../adminFetch';

interface Window {
  last24h: number;
  last30d: number;
  retained: number;
}

interface Economy {
  computedAt: number | null;
  users?: number;
  usersWithBalance?: number;
  usersOverdrawn?: number;
  coinsOutstanding?: number;
  granted?: Window;
  spent?: Window;
  grantsByType?: Record<string, { count: number; coins: number }>;
  purchases?: { count: number; coins: number; last30dCount: number; last30dCoins: number };
  accounts?: { total: number; anonymous: number; linked: number; newLast7d: number };
}

const n = (value?: number) => (value ?? 0).toLocaleString();

/**
 * Coin economy overview.
 *
 * Every figure comes from one snapshot written by the nightly wallet sweep, not from a live
 * query: Realtime Database has no aggregation, so the only way to total the economy is to read
 * every wallet — which is a thing to do once a night, not once a page view. `computedAt` is shown
 * for that reason, so nobody reads these as live numbers.
 */
export default function EconomySection() {
  const [data, setData] = useState<Economy | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    adminFetch<Economy>('/api/admin/economy')
      .then((res) => { if (active) setData(res); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; };
  }, []);

  if (error) return <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>;

  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (data.computedAt === null) {
    return (
      <Alert severity="info" sx={{ mb: 4 }}>
        No economy snapshot yet. It is written by the nightly wallet sweep, so these figures
        appear after its first run.
      </Alert>
    );
  }

  const computed = DateTime.fromSeconds(data.computedAt);
  const overdrawn = data.usersOverdrawn ?? 0;
  const anonymousShare = data.accounts?.total
    ? Math.round((data.accounts.anonymous / data.accounts.total) * 100)
    : 0;

  const cards = [
    {
      label: 'Coins outstanding',
      value: n(data.coinsOutstanding),
      caption: `${n(data.usersWithBalance)} accounts holding coins`,
      icon: <MonetizationOnIcon sx={{ color: 'primary.main', fontSize: 30 }} />,
    },
    {
      label: 'Accounts',
      value: n(data.accounts?.total),
      caption: `${anonymousShare}% anonymous · ${n(data.accounts?.newLast7d)} new this week`,
      icon: <PhoneAndroidIcon sx={{ color: 'primary.main', fontSize: 30 }} />,
      to: '/admin/app-users',
    },
    {
      label: 'Granted (30d)',
      value: n(data.granted?.last30d),
      caption: `${n(data.granted?.last24h)} in the last day`,
      icon: <TrendingUpIcon sx={{ color: 'success.main', fontSize: 30 }} />,
    },
    {
      label: 'Spent (30d)',
      value: n(data.spent?.last30d),
      caption: `${n(data.spent?.last24h)} in the last day`,
      icon: <TrendingDownIcon sx={{ color: 'primary.main', fontSize: 30 }} />,
    },
    {
      label: 'Purchased (30d)',
      value: n(data.purchases?.last30dCoins),
      caption: `${n(data.purchases?.last30dCount)} purchases`,
      icon: <ShoppingCartIcon sx={{ color: 'primary.main', fontSize: 30 }} />,
    },
    {
      label: 'Overdrawn',
      value: n(overdrawn),
      // Not a fault: a wallet goes negative when two handsets draw on the same grant before
      // they sync. Worth watching, not worth alarming over.
      caption: overdrawn ? 'Spent on two devices before syncing' : 'No negative balances',
      icon: (
        <WarningAmberIcon
          sx={{ color: overdrawn ? 'warning.main' : 'success.main', fontSize: 30 }}
        />
      ),
      tone: overdrawn ? 'warning' : undefined,
    },
  ];

  const byType = Object.entries(data.grantsByType ?? {})
    .sort(([, a], [, b]) => b.coins - a.coins);

  return (
    <Box sx={{ mb: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
          COIN ECONOMY
        </Typography>
        <Tooltip title={computed.toLocaleString(DateTime.DATETIME_MED)}>
          <Chip
            size="small"
            variant="outlined"
            label={`Snapshot ${computed.toRelative()}`}
          />
        </Tooltip>
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {cards.map(({ label, value, caption, icon, to, tone }) => (
          <Grid key={label} size={{ xs: 6, md: 4, lg: 2 }}>
            <Paper
              {...(to ? { component: RouterLink, to } : {})}
              sx={{
                p: 2.5,
                height: '100%',
                display: 'block',
                textDecoration: 'none',
                border: '1px solid',
                borderColor: tone === 'warning' ? 'warning.main' : 'divider',
                transition: 'border-color 0.2s, transform 0.2s',
                ...(to && {
                  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                }),
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                {icon}
                <Typography variant="h5" fontWeight={700}>{value}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="caption" color="text.secondary">{caption}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {byType.length > 0 && (
        <Paper sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Where coins come from</Typography>
            <Button component={RouterLink} to="/admin/app-users" size="small">App users</Button>
          </Stack>
          <Divider />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell align="right">Grants</TableCell>
                <TableCell align="right">Coins</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byType.map(([type, { count, coins }]) => (
                <TableRow key={type} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{type}</Typography>
                  </TableCell>
                  <TableCell align="right">{n(count)}</TableCell>
                  <TableCell align="right">{n(coins)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Totals cover the retention window only — history older than that is deleted by the
              same nightly pass that writes these figures.
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
