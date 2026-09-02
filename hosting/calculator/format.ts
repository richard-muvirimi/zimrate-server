/** Number and time formatting for the rates list. */

/**
 * A plain number for an input field — no grouping separators, since the field
 * has to parse back what it displays.
 *
 * The Android app fixes rate fields at 2dp. Here they get up to 4, trimmed,
 * because a rate quoted below 1 would round away to nothing at 2.
 */
export function formatNumber(value: number, maxDecimals = 4): string {
  if (!Number.isFinite(value)) return '';

  return String(Number(value.toFixed(maxDecimals)));
}

/** Converted amounts stay at 2dp, as they are in the app. */
export function formatAmount(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '';
}

const DIVISIONS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
];

/**
 * "3 hours ago", from a unix timestamp in seconds — the relative form the app's
 * rows use, so how old a rate is reads at a glance rather than needing a date
 * compared against today's.
 */
export function relativeTime(unixSeconds?: number | null): string {
  if (!unixSeconds) return '';

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  // Negative for the past, which is what every timestamp here is.
  let duration = (unixSeconds * 1000 - Date.now()) / 1000;

  for (const [unit, span] of DIVISIONS) {
    if (Math.abs(duration) < span) return formatter.format(Math.round(duration), unit);
    duration /= span;
  }

  return formatter.format(Math.round(duration), 'year');
}
