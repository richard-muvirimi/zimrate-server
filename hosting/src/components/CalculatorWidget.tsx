import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  Box, TextField, Select, MenuItem, FormControl, InputLabel,
  Typography, CircularProgress, Paper, Grid, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import Decimal from 'decimal.js';
import { map, sortBy, uniq, without } from 'lodash-es';
import { GET_RATES } from '../graphql/queries';
import { detectLocaleCurrency } from '../utils/localeCurrency';

interface Rate {
  rate: number;
  currency: string;
}

/** The aggregations the API exposes, in the order the rates table lists them. */
const AGGREGATES = [
  { key: 'max', label: 'Max', hint: 'Highest rate across sources' },
  { key: 'mean', label: 'Mean', hint: 'Average of all sources' },
  { key: 'min', label: 'Min', hint: 'Lowest rate across sources' },
  { key: 'median', label: 'Median', hint: 'Middle rate across sources' },
  { key: 'mode', label: 'Mode', hint: 'Most common rate across sources' },
  { key: 'random', label: 'Random', hint: "One source's rate, picked at random" },
] as const;
type AggregateKey = (typeof AGGREGATES)[number]['key'];

type RatesData = Record<AggregateKey, Rate[]>;

/** Every rate is quoted per 1 USD, so USD is the base and never appears in the API list. */
const BASE_CURRENCY = 'USD';
/** Last resort when the visitor's locale currency isn't quoted — this is a Zimbabwe rates site. */
const HOME_CURRENCY = 'ZWG';

export default function CalculatorWidget() {
  const { data, loading } = useQuery<RatesData>(GET_RATES);

  // null means "not chosen yet" — the default is derived from locale below.
  const [fromCurrency, setFromCurrency] = useState<string | null>(null);
  const [toCurrency, setToCurrency] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
  // Matches DEFAULT_AGGREGATE in calculator/store/rates.ts, so both calculators
  // open on the same rate.
  const [prefer, setPrefer] = useState<AggregateKey>('median');

  // Read once per mount; navigator.languages does not change mid-session.
  const localeCurrency = useMemo(() => detectLocaleCurrency(), []);

  // USD is prepended explicitly: without it the default "From" value matched no
  // MenuItem and the select rendered blank, and USD could not be picked at all.
  const currencies = useMemo(() => {
    const fromApi = sortBy(without(uniq(map(data?.mean ?? [], 'currency')), BASE_CURRENCY));
    return [BASE_CURRENCY, ...fromApi];
  }, [data]);

  // Defaults are derived rather than stored, so they settle correctly once the
  // currency list arrives without any setState-in-effect churn.
  //
  // "From" is the visitor's own currency when we quote it, since converting
  // *from* what you hold is the common case. "To" is then the base, or the home
  // currency when the visitor is already on USD.
  const defaults = useMemo(() => {
    if (currencies.length === 0) return { from: BASE_CURRENCY, to: BASE_CURRENCY };

    const quoted = (code: string | null) => (code && currencies.includes(code) ? code : null);
    const local = quoted(localeCurrency);

    if (local && local !== BASE_CURRENCY) {
      return { from: local, to: BASE_CURRENCY };
    }

    // Visitor is on USD (or we could not tell): convert into the home currency.
    const target =
      quoted(HOME_CURRENCY) ?? currencies.find((c) => c !== BASE_CURRENCY) ?? BASE_CURRENCY;
    return { from: BASE_CURRENCY, to: target };
  }, [currencies, localeCurrency]);

  // An explicit choice always wins; otherwise fall back to a currency that
  // exists rather than showing an empty select.
  const from = (fromCurrency && currencies.includes(fromCurrency)) ? fromCurrency : defaults.from;
  const to = (toCurrency && currencies.includes(toCurrency)) ? toCurrency : defaults.to;

  const rateFor = (code: string) =>
    code === BASE_CURRENCY ? 1 : data?.[prefer]?.find((r) => r.currency === code)?.rate;

  // Derived during render rather than via an effect — result is a pure function
  // of the query data and the inputs.
  const result = useMemo(() => {
    const num = parseFloat(amount);
    if (!data?.[prefer] || !amount || isNaN(num)) return '';

    const fromRate = rateFor(from);
    const toRate = rateFor(to);
    if (!fromRate || !toRate) return '';

    // All rates expressed as units-per-USD; formula: result = amount * toRate / fromRate
    const converted = new Decimal(num).times(toRate).div(fromRate).toDecimalPlaces(2);
    return converted.toNumber().toLocaleString(undefined, { maximumFractionDigits: 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, amount, from, to, prefer]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'background.elevated',
        border: '1px solid', borderColor: 'divider',
        borderRadius: 2,
        maxWidth: 440,
      }}
    >
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Currency Converter
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid size={7}>
              <TextField
                label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </Grid>
            <Grid size={5}>
              <FormControl size="small" fullWidth>
                <InputLabel>From</InputLabel>
                <Select
                  value={from}
                  label="From"
                  onChange={(e) => setFromCurrency(e.target.value)}
                >
                  {currencies.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <FormControl size="small" fullWidth>
            <InputLabel>To</InputLabel>
            <Select
              value={to}
              label="To"
              onChange={(e) => setToCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Segmented switch: one track, the chosen aggregate raised within it. */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Rate
            </Typography>
            <ToggleButtonGroup
              value={prefer}
              exclusive
              // Clicking the active option passes null; keep the current choice.
              onChange={(_, value: AggregateKey | null) => value && setPrefer(value)}
              color="primary"
              size="small"
              aria-label="Rate to convert with"
              // Too narrow for one row on phones: an even 3×2 grid there rather
              // than a wrapped pill with one option stranded on the second line.
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, auto)' },
                gap: 0.25,
                p: 0.375,
                borderRadius: { xs: '14px', sm: '999px' },
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '& .MuiToggleButtonGroup-grouped': {
                  border: 0,
                  borderRadius: 999,
                  m: 0,
                  px: 1.25,
                  py: 0.375,
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                  '&.Mui-selected': { color: 'primary.main' },
                },
              }}
            >
              {AGGREGATES.map(({ key, label, hint }) => (
                <ToggleButton key={key} value={key} title={hint}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {result && (
            <Box
              sx={{
                px: 2, py: 1.5,
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px solid', borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary">Result</Typography>
              <Typography variant="h5" fontWeight={700} color="primary">
                {result} <Typography component="span" variant="h6" color="text.secondary">{to}</Typography>
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}
