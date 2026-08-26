import { gql } from '@apollo/client';

/**
 * Mirrors the query the legacy site used: every aggregation the API supports,
 * plus the raw per-source rates, so a currency row can be expanded to show the
 * full breakdown without a second round trip.
 */
export const GET_RATES = gql`
  query GetRates {
    min: rate(prefer: MIN) { rate currency }
    max: rate(prefer: MAX) { rate currency }
    mean: rate(prefer: MEAN) { rate currency }
    median: rate(prefer: MEDIAN) { rate currency }
    mode: rate(prefer: MODE) { rate currency }
    random: rate(prefer: RANDOM) { rate currency }
    rates: rate { rate last_rate last_checked last_updated currency name url }
    notice: info
  }
`;
