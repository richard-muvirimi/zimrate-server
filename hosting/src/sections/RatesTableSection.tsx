import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel, Fade, Button, Collapse,
  Link, Stack, Divider,
} from '@mui/material';
import { useMotionTimeout } from '../hooks/useReducedMotion';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useQuery } from '@apollo/client/react';
import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { DateTime } from 'luxon';
import { compact, groupBy, keyBy, map, mapValues, max, sortBy, uniqBy } from 'lodash-es';
import { GET_RATES } from '../graphql/queries';
import CurrencyLabel from '../components/CurrencyLabel';

interface Rate {
  rate: number;
  last_rate?: number;
  currency: string;
  name?: string;
  last_checked?: number;
  last_updated?: number;
  url?: string;
}

interface AggregateRate {
  rate: number;
  currency: string;
}

interface RatesData {
  min: AggregateRate[];
  max: AggregateRate[];
  mean: AggregateRate[];
  median: AggregateRate[];
  mode: AggregateRate[];
  random: AggregateRate[];
  rates: Rate[];
  notice?: string;
}

/** The six aggregations the API exposes, in the order the legacy site showed them. */
const AGGREGATES = ['max', 'mean', 'min', 'median', 'mode', 'random'] as const;
type AggregateKey = (typeof AGGREGATES)[number];

interface CurrencyRow {
  currency: string;
  lastChecked?: number;
  lastUpdated?: number;
  minRate: number;
  maxRate: number;
  aggregated: Record<AggregateKey, number | undefined>;
  rates: Rate[];
  sources: { href: string; hostname: string }[];
}

function formatRate(rate?: number) {
  if (rate == null) return '—';
  return rate.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 5,
  });
}

function formatDate(ts?: number) {
  if (!ts) return '—';
  return DateTime.fromSeconds(ts).toLocaleString(DateTime.DATE_MED);
}

function hostnameOf(url?: string) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return { href: u.toString(), hostname: u.hostname };
  } catch {
    return null;
  }
}

/** Groups the flat rate list into one row per currency, with all aggregates attached. */
function buildRows(data?: RatesData): CurrencyRow[] {
  if (!data?.rates?.length) return [];

  const byAggregate = {} as Record<AggregateKey, Record<string, number>>;
  for (const key of AGGREGATES) {
    byAggregate[key] = mapValues(keyBy(data[key] ?? [], 'currency'), (r) => r.rate);
  }

  return sortBy(
    map(groupBy(data.rates, 'currency'), (rates, currency) => {
      const sorted = sortBy(rates, 'rate');
      const sources = uniqBy(compact(sorted.map((r) => hostnameOf(r.url))), 'href');

      const aggregated = {} as Record<AggregateKey, number | undefined>;
      for (const key of AGGREGATES) aggregated[key] = byAggregate[key][currency];

      return {
        currency,
        // Zero is "never checked" here, and `|| undefined` is what the row's
        // date formatter reads as a dash.
        lastChecked: max(map(sorted, (r) => r.last_checked ?? 0)) || undefined,
        lastUpdated: max(map(sorted, (r) => r.last_updated ?? 0)) || undefined,
        minRate: sorted[0].rate,
        maxRate: sorted[sorted.length - 1].rate,
        aggregated,
        rates: sorted,
        sources,
      };
    }),
    'currency',
  );
}

/** The aggregates in the strip above that this source's unrounded rate equals. */
function tagsFor(rate: number, row: CurrencyRow) {
  return AGGREGATES.filter((key) => row.aggregated[key] === rate);
}

function DeltaChip({ rate, lastRate }: { rate: number; lastRate?: number }) {
  if (!lastRate || lastRate <= 0) return <>—</>;
  const change = new Decimal(rate).minus(lastRate).div(lastRate).times(100);
  // A move too small to survive the 2dp label is shown as flat rather than as a
  // signed "-0.00%" under a red arrow, which reads as a fall that did not happen.
  const flat = change.abs().lt(0.005);
  const rising = change.gt(0);
  return (
    <Chip
      size="small"
      variant="outlined"
      color={flat ? 'default' : rising ? 'success' : 'error'}
      icon={flat ? undefined : rising ? <TrendingUpIcon /> : <TrendingDownIcon />}
      label={flat ? '0.00%' : `${rising ? '+' : ''}${change.toFixed(2)}%`}
    />
  );
}

/** The expanded panel: aggregates, sources, and a per-source current/previous/delta table. */
function CurrencyDetail({ row }: { row: CurrencyRow }) {
  return (
    <Box
      sx={{
        m: 2,
        p: { xs: 2, md: 3 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.elevated',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <Typography variant="h4" fontWeight={700}>
          {row.currency.toUpperCase()}
        </Typography>
        <Stack direction="row" spacing={4}>
          <Box textAlign="right">
            <Typography variant="body2">{formatDate(row.lastChecked)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Checked
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="body2">{formatDate(row.lastUpdated)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Updated
            </Typography>
          </Box>
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Every aggregation the API can return for this currency. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
          gap: 2,
          textAlign: 'center',
        }}
      >
        {AGGREGATES.map((key) => (
          <Box key={key}>
            <Typography variant="body2" fontWeight={700} color="primary">
              {formatRate(row.aggregated[key])}
            </Typography>
            <Typography variant="caption" color="text.secondary" textTransform="capitalize">
              {key}
            </Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            SOURCES
          </Typography>
          <Stack component="ul" sx={{ pl: 2, m: 0, mt: 1 }} spacing={0.5}>
            {row.sources.map((s) => (
              <li key={s.href}>
                <Link href={s.href} target="_blank" rel="noopener" variant="body2" underline="hover">
                  {s.hostname}
                </Link>
              </li>
            ))}
            {row.sources.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No source URLs recorded.
              </Typography>
            )}
          </Stack>
        </Box>

        <Box sx={{ flex: 1.4, overflowX: 'auto' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            PER SOURCE
          </Typography>
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Matches</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Current</TableCell>
                <TableCell align="right">Previous</TableCell>
                <TableCell align="right">Delta</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {row.rates.map((r, i) => (
                <TableRow key={`${r.name ?? r.url ?? i}`}>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {tagsFor(r.rate, row).map((key) => (
                        <Chip
                          key={key}
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={key}
                          sx={{ textTransform: 'capitalize', height: 20, fontSize: '0.7rem' }}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 180,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.name ?? hostnameOf(r.url)?.hostname ?? '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700}>
                      {formatRate(r.rate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{formatRate(r.last_rate)}</TableCell>
                  <TableCell align="right">
                    <DeltaChip rate={r.rate} lastRate={r.last_rate} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    </Box>
  );
}

export default function RatesTableSection() {
  const { data, loading, error } = useQuery<RatesData>(GET_RATES);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prefer, setPrefer] = useState<AggregateKey | 'range'>('range');
  const motionTimeout = useMotionTimeout(500);

  const rows = useMemo(() => buildRows(data), [data]);

  const lastChecked = useMemo(
    () => (rows.length ? Math.max(...rows.map((r) => r.lastChecked ?? 0)) || undefined : undefined),
    [rows],
  );

  return (
    <Box
      id="rates"
      sx={{
        py: { xs: 8, md: 12 },
        px: { xs: 2, md: 6 },
        bgcolor: 'background.subtle',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            mb: 4,
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Live Exchange Rates
            </Typography>
            {lastChecked && (
              <Typography variant="body2" color="text.secondary">
                Last checked {formatDate(lastChecked)} · against the United States Dollar
              </Typography>
            )}
            {data?.notice && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {data.notice}
              </Typography>
            )}
          </Box>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Show</InputLabel>
            <Select
              value={prefer}
              label="Show"
              onChange={(e) => setPrefer(e.target.value as AggregateKey | 'range')}
            >
              <MenuItem value="range">Range (min–max)</MenuItem>
              {AGGREGATES.map((key) => (
                <MenuItem key={key} value={key} sx={{ textTransform: 'capitalize' }}>
                  {key}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to load rates. Please refresh to try again.
          </Alert>
        )}

        {!loading && !error && rows.length === 0 && (
          <Alert severity="info">
            No rates available right now. Rates are scraped hourly — check back shortly.
          </Alert>
        )}

        {!loading && !error && rows.length > 0 && (
          <Fade in timeout={motionTimeout}>
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <Table>
                <TableHead>
                  {/* Explicit widths: without them the browser hands the slack
                      to the last column and squeezes the rest to the left. */}
                  <TableRow>
                    <TableCell sx={{ width: '18%' }}>Currency</TableCell>
                    <TableCell align="right" sx={{ width: '32%', textTransform: 'capitalize' }}>
                      {prefer === 'range' ? 'Rates' : prefer}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ width: '14%', display: { xs: 'none', sm: 'table-cell' } }}
                    >
                      Sources
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ width: '26%', display: { xs: 'none', md: 'table-cell' } }}
                    >
                      Updated
                    </TableCell>
                    {/* '1%' shrinks the action column to its content. */}
                    <TableCell align="right" sx={{ width: '1%', whiteSpace: 'nowrap' }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const isOpen = expanded === row.currency;
                    return [
                      <TableRow key={row.currency} hover sx={{ '& > *': { borderBottom: isOpen ? 'none' : undefined } }}>
                        <TableCell>
                          <CurrencyLabel currency={row.currency} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={700} color="primary">
                            {prefer === 'range'
                              ? row.minRate === row.maxRate
                                ? formatRate(row.minRate)
                                : `${formatRate(row.minRate)} – ${formatRate(row.maxRate)}`
                              : formatRate(row.aggregated[prefer])}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          <Typography variant="body2" color="text.secondary">
                            {row.rates.length}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(row.lastUpdated)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Button
                            size="small"
                            onClick={() => setExpanded(isOpen ? null : row.currency)}
                            endIcon={isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${row.currency}`}
                          >
                            {isOpen ? 'Less' : 'More'}
                          </Button>
                        </TableCell>
                      </TableRow>,
                      <TableRow key={`${row.currency}-detail`}>
                        <TableCell colSpan={5} sx={{ py: 0, borderBottom: isOpen ? undefined : 'none' }}>
                          <Collapse in={isOpen} timeout={motionTimeout} unmountOnExit>
                            <CurrencyDetail row={row} />
                          </Collapse>
                        </TableCell>
                      </TableRow>,
                    ];
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Fade>
        )}
      </Box>
    </Box>
  );
}
