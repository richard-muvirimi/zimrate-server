import { DateTime } from 'luxon';

type Stamp = { toMillis?: () => number; toDate?: () => Date };

export interface RateDoc {
  id: string;
  rate_name?: string;
  rate_currency?: string;
  rate?: number;
  last_rate?: number;
  enabled?: boolean;
  probation?: boolean;
  source_id?: string | null;
  updated_at?: Stamp;
}

/**
 * Health lives on the source, not the rate. A rate the scraper cannot read is
 * deleted rather than flagged, so there is no such thing as a failing rate —
 * only a source whose last pass failed.
 */
export interface SourceDoc {
  id: string;
  name?: string;
  url?: string;
  enabled?: boolean;
  status?: boolean;
  status_message?: string;
  probation?: boolean;
  last_scraped?: Stamp;
  last_success?: Stamp;
}

export const millis = (value?: Stamp) => value?.toMillis?.() ?? 0;

export const toDateTime = (value?: Stamp) =>
  value?.toDate ? DateTime.fromJSDate(value.toDate()) : null;

/** Mirrors UNSEEN_GRACE_HOURS in functions/src/models/Rate.js. */
const UNSEEN_GRACE_MS = 24 * 3_600_000;

/**
 * Whether the public API serves this rate. Mirrors Rate.findAll and
 * Rate.fromServedSource on the server; the caller has already applied the
 * freshness window, since that is the query the rates were read with.
 */
export function isLive(rate: RateDoc, sources: Map<string, SourceDoc>): boolean {
  if (rate.enabled !== true || rate.probation) return false;
  if (!rate.source_id) return true;

  const source = sources.get(rate.source_id);
  if (!source || source.enabled === false) return false;

  const lastSuccess = millis(source.last_success);
  return !lastSuccess || millis(rate.updated_at) >= lastSuccess - UNSEEN_GRACE_MS;
}

export type SourceState = 'working' | 'probation' | 'failing' | 'unchecked' | 'off';

export function sourceState(source: SourceDoc): SourceState {
  if (source.enabled === false) return 'off';
  if (!source.last_scraped) return 'unchecked';
  if (source.status === false) return 'failing';
  if (source.probation) return 'probation';
  return 'working';
}

export interface FreshnessBucket {
  label: string;
  count: number;
  /** Past the six hours the Rates page calls stale, though still shown. */
  lagging: boolean;
}

/** Scraping runs hourly; six hours matches the Rates page's "Stale" chip. */
const LAGGING_AFTER_HOURS = 6;

const BUCKETS = [
  { to: 1, label: 'Under 1 hr' },
  { to: 6, label: '1–6 hrs' },
  { to: 24, label: '6–24 hrs' },
  { to: 72, label: '1–3 days' },
];

/**
 * Live rates grouped by how long ago their source last confirmed them. The
 * last bucket ends at the freshness window, because nothing older is served.
 */
export function freshnessBuckets(rates: RateDoc[], windowDays: number, now = Date.now()): FreshnessBucket[] {
  const windowHours = windowDays * 24;
  const fixed = BUCKETS.filter((b) => b.to < windowHours);
  const from = fixed.at(-1)?.to ?? 0;
  const last = {
    to: Infinity,
    label: from === 0 ? `Under ${windowDays} days`
      : from < 24 ? `${from} hrs–${windowDays} days` : `${from / 24}–${windowDays} days`,
  };

  const counts = [...fixed, last].map(() => 0);
  const ends = [...fixed, last].map((b) => b.to);
  for (const r of rates) {
    const age = (now - millis(r.updated_at)) / 3_600_000;
    counts[ends.findIndex((to) => age < to)] += 1;
  }

  return [...fixed, last].map((b, i) => ({
    label: b.label,
    count: counts[i],
    lagging: (i === 0 ? 0 : ends[i - 1]) >= LAGGING_AFTER_HOURS,
  }));
}

export interface QuoteRow {
  currency: string;
  median: number;
  min: number;
  max: number;
  /** Quotes sharing a value are one dot, so the tooltip can name every source behind it. */
  points: { rate: number; offset: number; names: string[] }[];
  count: number;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Per currency, every live quote as its distance from the median quote. Put on
 * one percentage axis, currencies of very different size (ZWG at ~27 per USD,
 * ZAR at ~18) can be compared for how much their sources disagree.
 */
export function quoteSpread(rates: RateDoc[], limit = 8): QuoteRow[] {
  const byCurrency = new Map<string, RateDoc[]>();
  for (const r of rates) {
    if (!r.rate_currency || typeof r.rate !== 'number' || r.rate <= 0) continue;
    byCurrency.set(r.rate_currency, [...(byCurrency.get(r.rate_currency) ?? []), r]);
  }

  return [...byCurrency.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, limit)
    .map(([currency, list]) => {
      const mid = median(list.map((r) => r.rate!));
      const grouped = new Map<number, string[]>();
      for (const r of list) {
        grouped.set(r.rate!, [...(grouped.get(r.rate!) ?? []), r.rate_name || 'Unnamed rate']);
      }
      const points = [...grouped.entries()].map(([rate, names]) => ({
        rate,
        offset: rate / mid - 1,
        names,
      }));
      return {
        currency,
        median: mid,
        min: Math.min(...points.map((p) => p.offset)),
        max: Math.max(...points.map((p) => p.offset)),
        points,
        count: list.length,
      };
    });
}

export interface Move {
  id: string;
  currency: string;
  name: string;
  from: number;
  to: number;
  change: number;
}

/** Live rates whose value differs from their previous reading, largest change first. */
export function biggestMoves(rates: RateDoc[], limit = 8): Move[] {
  return rates
    .filter((r) => typeof r.rate === 'number' && typeof r.last_rate === 'number'
      && r.last_rate > 0 && r.rate !== r.last_rate)
    .map((r) => ({
      id: r.id,
      currency: r.rate_currency ?? '—',
      name: r.rate_name || 'Unnamed rate',
      from: r.last_rate!,
      to: r.rate!,
      change: r.rate! / r.last_rate! - 1,
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, limit);
}
