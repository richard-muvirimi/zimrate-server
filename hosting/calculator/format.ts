/** Number and time formatting for the rates list. */
import Decimal from 'decimal.js';
import { DateTime } from 'luxon';

/**
 * A plain number for an input field — no grouping separators, since the field
 * has to parse back what it displays.
 *
 * The Android app fixes rate fields at 2dp. Here they get up to 4, trimmed,
 * because a rate quoted below 1 would round away to nothing at 2.
 */
export function formatNumber(value: Decimal.Value, maxDecimals = 4): string {
  const number = new Decimal(value);
  if (!number.isFinite()) return '';

  return number.toDecimalPlaces(maxDecimals).toString();
}

/** Converted amounts stay at 2dp, as they are in the app. */
export function formatAmount(value: Decimal.Value): string {
  const amount = new Decimal(value);
  return amount.isFinite() ? amount.toFixed(2) : '';
}

/**
 * "3 hours ago", from a unix timestamp in seconds — the relative form the app's
 * rows use, so how old a rate is reads at a glance rather than needing a date
 * compared against today's.
 */
export function relativeTime(unixSeconds?: number | null): string {
  if (!unixSeconds) return '';

  return DateTime.fromSeconds(unixSeconds).toRelative() ?? '';
}
