import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Grid, Paper, Typography, CircularProgress, Stack, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Divider, Tooltip,
} from '@mui/material';
import {
  collection, getCountFromServer, query, orderBy, getDocs, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import SourceIcon from '@mui/icons-material/Source';
import PublicIcon from '@mui/icons-material/Public';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import UpdateIcon from '@mui/icons-material/Update';
import AddIcon from '@mui/icons-material/Add';
import { DateTime } from 'luxon';
import EconomySection from '../components/EconomySection';
import StatTile from '../components/dashboard/StatTile';
import ChartCard from '../components/dashboard/ChartCard';
import SectionHeading from '../components/dashboard/SectionHeading';
import {
  FreshnessChart, QuoteSpreadChart, RateMovesChart, SourceHealthChart,
} from '../components/dashboard/RateCharts';
import {
  biggestMoves, freshnessBuckets, isLive, quoteSpread, sourceState, toDateTime,
  type RateDoc, type SourceDoc, type SourceState,
} from '../components/dashboard/rateStats';
import LinkifiedText from '../../components/LinkifiedText';

/** Mirrors DEFAULT_FRESHNESS_DAYS in functions/src/models/Rate.js. */
const DEFAULT_FRESHNESS_DAYS = 7;

/** A last update older than this means the hourly scrape has missed several runs. */
const QUIET_AFTER_HOURS = 6;

interface Loaded {
  rates: RateDoc[];
  sources: SourceDoc[];
  totalRates: number;
  freshnessDays: number;
  scrapingEnabled: boolean;
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 160, px: 2, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">{children}</Typography>
    </Box>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [optionsSnap, sourcesSnap, totalSnap] = await Promise.all([
          getDocs(collection(db, 'options')),
          getDocs(collection(db, 'sources')),
          getCountFromServer(collection(db, 'rates')),
        ]);

        const options = optionsSnap.docs.map((d) => d.data());
        const option = (key: string) => options.find((o) => o.key === key)?.value;
        const stored = Number(option('rate_freshness_days'));
        const freshnessDays = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_FRESHNESS_DAYS;

        // Only rates inside the freshness window: nothing older is served, and
        // the collection keeps a year of dead records the dashboard has no use for.
        const cutoff = DateTime.now().minus({ days: freshnessDays }).toJSDate();
        const ratesSnap = await getDocs(query(
          collection(db, 'rates'),
          where('updated_at', '>', Timestamp.fromDate(cutoff)),
          orderBy('updated_at', 'desc'),
        ));

        setData({
          rates: ratesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RateDoc),
          sources: sourcesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SourceDoc),
          totalRates: totalSnap.data().count,
          freshnessDays,
          scrapingEnabled: option('scraping_enabled') !== 'false',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
  }, []);

  const view = useMemo(() => {
    if (!data) return null;

    const sourceMap = new Map(data.sources.map((s) => [s.id, s]));
    const live = data.rates.filter((r) => isLive(r, sourceMap));

    const sourceCounts: Record<SourceState, number> = {
      working: 0, probation: 0, failing: 0, unchecked: 0, off: 0,
    };
    data.sources.forEach((s) => { sourceCounts[sourceState(s)] += 1; });

    // Sources whose last scrape failed. A source that has never been scraped
    // also has status false, but that is not a fault, so sourceState keeps
    // the two apart.
    const failing = data.sources
      .filter((s) => sourceState(s) === 'failing')
      .sort((a, b) => (toDateTime(b.last_scraped)?.toMillis() ?? 0) - (toDateTime(a.last_scraped)?.toMillis() ?? 0));

    const byCurrency = new Map<string, number>();
    live.forEach((r) => r.rate_currency && byCurrency.set(r.rate_currency, (byCurrency.get(r.rate_currency) ?? 0) + 1));
    const topCurrencies = [...byCurrency.entries()].sort(([, a], [, b]) => b - a).map(([c]) => c);

    return {
      live,
      sourceCounts,
      failing,
      topCurrencies,
      lastUpdated: toDateTime(data.rates[0]?.updated_at),
      buckets: freshnessBuckets(live, data.freshnessDays),
      spread: quoteSpread(live),
      moves: biggestMoves(live),
    };
  }, [data]);

  if (error) return <Alert severity="error"><LinkifiedText>{error}</LinkifiedText></Alert>;

  if (!data || !view) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const { live, sourceCounts, failing, topCurrencies, lastUpdated, buckets, spread, moves } = view;
  const enabledSources = data.sources.length - sourceCounts.off;
  const reporting = sourceCounts.working + sourceCounts.probation;
  const quiet = !lastUpdated || lastUpdated < DateTime.now().minus({ hours: QUIET_AFTER_HOURS });

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>Overview</Typography>
          <Typography variant="body2" color="text.secondary">
            What visitors and app users are seeing right now, and anything that needs a look.
          </Typography>
        </Box>
        <Button component={RouterLink} to="/admin/sources/new" variant="contained" startIcon={<AddIcon />}>
          Add source
        </Button>
      </Stack>

      <SectionHeading title="Exchange rates" />

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            label="Rates on the site"
            value={live.length.toLocaleString()}
            caption={`Out of ${data.totalRates.toLocaleString()} on record`}
            icon={<CurrencyExchangeIcon />}
            to="/admin/rates"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            label="Currencies covered"
            value={topCurrencies.length}
            caption={topCurrencies.length
              ? `${topCurrencies.slice(0, 3).join(', ')}${topCurrencies.length > 3 ? ` +${topCurrencies.length - 3} more` : ''}`
              : 'None shown yet'}
            icon={<PublicIcon />}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            label="Sources reporting"
            value={`${reporting} of ${enabledSources}`}
            caption={failing.length
              ? `${failing.length} failed on the last check`
              : sourceCounts.probation
                ? `${sourceCounts.probation} on probation, rates held back`
                : 'Every switched-on source is working'}
            icon={failing.length ? <WarningAmberIcon /> : <SourceIcon />}
            tone={failing.length ? 'warning' : 'good'}
            to="/admin/sources"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Tooltip title={lastUpdated?.toLocaleString(DateTime.DATETIME_MED) ?? ''}>
            <Box sx={{ height: '100%' }}>
              <StatTile
                label="Latest rate check"
                value={lastUpdated?.toRelative({ style: 'short' }) ?? 'Never'}
                caption={!data.scrapingEnabled
                  ? 'Automatic updates are paused'
                  : quiet
                    ? 'Automatic updates are on, but nothing has come in for a while'
                    : 'Automatic updates are on, every hour'}
                icon={<UpdateIcon />}
                tone={!data.scrapingEnabled || quiet ? 'warning' : 'default'}
                to="/admin/options"
              />
            </Box>
          </Tooltip>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ChartCard
            title="How fresh are the rates?"
            subtitle="Rates on the site, by how long ago their source last confirmed them"
            footnote={`Rates not confirmed for ${data.freshnessDays} days are taken off the site automatically.`}
          >
            {live.length
              ? <FreshnessChart buckets={buckets} />
              : <EmptyChart>No rates are on the site yet.</EmptyChart>}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <ChartCard
            title="Source health"
            subtitle="How each source did on its last check"
            action={<Button component={RouterLink} to="/admin/sources" size="small">Sources</Button>}
          >
            {data.sources.length
              ? <SourceHealthChart counts={sourceCounts} />
              : <EmptyChart>No sources added yet.</EmptyChart>}
          </ChartCard>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ChartCard
            title="Do the sources agree?"
            subtitle="Each dot is a quote, placed by how far it sits from the typical rate for that currency"
            footnote="A wide spread is normal for ZiG, where official and cash rates differ. A lone dot far from the rest is worth checking."
          >
            {spread.length
              ? <QuoteSpreadChart rows={spread} />
              : <EmptyChart>Shown once two or more sources quote the same currency.</EmptyChart>}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <ChartCard
            title="Biggest moves"
            subtitle="Change from each rate's previous different value, per US dollar"
          >
            {moves.length
              ? <RateMovesChart moves={moves} />
              : <EmptyChart>No rate on the site has changed value yet.</EmptyChart>}
          </ChartCard>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 5 }}>
        <Grid size={{ xs: 12, lg: failing.length ? 7 : 12 }}>
          <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>Latest updates</Typography>
                <Typography variant="body2" color="text.secondary">The rates most recently confirmed by their source</Typography>
              </Box>
              <Button component={RouterLink} to="/admin/rates" size="small">All rates</Button>
            </Stack>
            <Divider />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Currency</TableCell>
                    <TableCell>Rate name</TableCell>
                    <TableCell align="right">Per US dollar</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      Checked
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.rates.slice(0, 8).map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{r.rate_currency ?? '—'}</Typography>
                      </TableCell>
                      <TableCell
                        sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <Typography variant="body2" color="text.secondary" noWrap>{r.rate_name ?? '—'}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {typeof r.rate === 'number' ? r.rate.toLocaleString() : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Typography variant="caption" color="text.secondary">
                          {toDateTime(r.updated_at)?.toRelative({ style: 'short' }) ?? '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.rates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="text.secondary" py={3}>No rates checked in the last {data.freshnessDays} days</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {failing.length > 0 && (
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper sx={{ border: '1px solid', borderColor: 'warning.main', borderRadius: 3, height: '100%' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 2 }}>
                <WarningAmberIcon color="warning" />
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Needs attention</Typography>
                  <Typography variant="body2" color="text.secondary">
                    These sources failed their last check. Their rates stay up until they go out of date.
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              <Box sx={{ px: 2.5, py: 2 }}>
                <Stack spacing={2}>
                  {failing.slice(0, 5).map((s) => {
                    const lastWorked = toDateTime(s.last_success);
                    return (
                      <Box key={s.id}>
                        <Typography variant="body2" fontWeight={600}>
                          {s.name || s.url || 'Unnamed source'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="p">
                          {s.status_message || 'The last check did not return any rates.'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lastWorked ? `Last worked ${lastWorked.toRelative()}` : 'Has never returned rates'}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
                <Button component={RouterLink} to="/admin/sources" size="small" sx={{ mt: 2 }}>
                  {failing.length > 5 ? `Review all ${failing.length} sources` : 'Review sources'}
                </Button>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>

      <EconomySection />
    </Box>
  );
}
