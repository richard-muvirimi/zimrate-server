import { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_RATES } from '../graphql/queries';
import { detectLocaleCurrency } from '../utils/localeCurrency';

/** Every rate is quoted per 1 USD, so it is always a valid base. */
const FALLBACK_BASE = 'USD';

interface RatesData {
  rates: { currency: string }[];
}

/**
 * Base currency for the v2 examples: the visitor's own, detected as the
 * calculator does, when the api quotes it. An unquoted base would show an
 * example that returns no rates, so it falls back to USD.
 *
 * Both pages that use this already run GET_RATES, so it is served from cache.
 * Until it arrives the locale guess is shown as is, since for most visitors
 * it is the answer.
 */
export function useExampleBase(): string {
  const { data } = useQuery<RatesData>(GET_RATES);
  // Read once per mount; navigator.languages does not change mid-session.
  const local = useMemo(() => detectLocaleCurrency(), []);

  if (!local) return FALLBACK_BASE;
  if (!data || local === FALLBACK_BASE) return local;
  return data.rates.some((rate) => rate.currency === local) ? local : FALLBACK_BASE;
}
