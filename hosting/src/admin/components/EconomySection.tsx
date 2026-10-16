import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Grid, Tooltip,
} from '@mui/material';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { DateTime } from 'luxon';
import { adminFetch } from '../adminFetch';
import StatTile from './dashboard/StatTile';
import ChartCard from './dashboard/ChartCard';
import SectionHeading from './dashboard/SectionHeading';
import { CoinFlowChart, GrantTypesChart } from './dashboard/CoinCharts';
import LinkifiedText from '../../components/LinkifiedText';

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

/** Grant types are the app's own identifiers; these read better to a person. */
function grantLabel(type: string) {
  if (type === 'purchase') return 'Bought in the app';
  if (type === 'unknown') return 'Not recorded';
  const words = type.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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

  const heading = <SectionHeading title="In-app coins" />;

  if (error) return <>{heading}<Alert severity="error" sx={{ mb: 4 }}><LinkifiedText>{error}</LinkifiedText></Alert></>;

  if (!data) {
    return (
      <>
        {heading}
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      </>
    );
  }

  if (data.computedAt === null) {
    return (
      <>
        {heading}
        <Alert severity="info" sx={{ mb: 4 }}>
          Coin figures are tallied once a night, so they will appear here after the first nightly run.
        </Alert>
      </>
    );
  }

  const computed = DateTime.fromSeconds(data.computedAt);
  const overdrawn = data.usersOverdrawn ?? 0;
  const anonymousShare = data.accounts?.total
    ? Math.round((data.accounts.anonymous / data.accounts.total) * 100)
    : 0;

  const bought30d = data.purchases?.last30dCoins ?? 0;
  // Purchases are grants too, so they are taken out of the granted total to be shown on their own.
  const earned30d = Math.max((data.granted?.last30d ?? 0) - bought30d, 0);

  const grantTypes = Object.entries(data.grantsByType ?? {})
    .map(([type, { count, coins }]) => ({ label: grantLabel(type), count, coins }))
    .sort((a, b) => b.coins - a.coins);

  const tiles = [
    {
      label: 'Coins held by users',
      value: n(data.coinsOutstanding),
      caption: `${n(data.usersWithBalance)} people have coins to spend`,
      icon: <MonetizationOnIcon />,
    },
    {
      label: 'App users',
      value: n(data.accounts?.total),
      caption: `${n(data.accounts?.newLast7d)} joined this week · ${anonymousShare}% not signed in`,
      icon: <PhoneAndroidIcon />,
      to: '/admin/app-users',
    },
    {
      label: 'Coins given out',
      value: n(data.granted?.last30d),
      caption: `Last 30 days · ${n(data.granted?.last24h)} in the last day`,
      icon: <TrendingUpIcon />,
    },
    {
      label: 'Coins spent',
      value: n(data.spent?.last30d),
      caption: `Last 30 days · ${n(data.spent?.last24h)} in the last day`,
      icon: <TrendingDownIcon />,
    },
    {
      label: 'Coins bought',
      value: n(bought30d),
      caption: `Last 30 days · ${n(data.purchases?.last30dCount)} purchases`,
      icon: <ShoppingCartIcon />,
    },
    {
      label: 'Balances below zero',
      value: n(overdrawn),
      // Not a fault: a wallet goes negative when two handsets draw on the same grant before
      // they sync. Worth watching, not worth alarming over.
      caption: overdrawn
        ? 'Coins spent on two phones before they synced. Worth watching, not a fault'
        : 'No negative balances',
      icon: <WarningAmberIcon />,
      tone: overdrawn ? 'warning' as const : 'good' as const,
    },
  ];

  return (
    <Box sx={{ mb: 4 }}>
      <SectionHeading title="In-app coins">
        <Tooltip title={`Tallied ${computed.toLocaleString(DateTime.DATETIME_MED)}. Coin figures are counted once a night, not live.`}>
          <Chip size="small" variant="outlined" label={`Counted ${computed.toRelative()}`} />
        </Tooltip>
      </SectionHeading>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        {tiles.map((tile) => (
          <Grid key={tile.label} size={{ xs: 6, md: 4 }}>
            <StatTile {...tile} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: grantTypes.length ? 6 : 12 }}>
          <ChartCard
            title="Coins in and out"
            subtitle="Coins added to wallets against coins spent, over the last 30 days"
          >
            <CoinFlowChart earned={earned30d} bought={bought30d} spent={data.spent?.last30d ?? 0} />
          </ChartCard>
        </Grid>
        {grantTypes.length > 0 && (
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard
              title="Where coins come from"
              subtitle="Coins given out, by how they were earned"
              action={<Button component={RouterLink} to="/admin/app-users" size="small">App users</Button>}
              footnote="Covers coin history the app still keeps. Older history is cleared each night."
            >
              <GrantTypesChart types={grantTypes} />
            </ChartCard>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
