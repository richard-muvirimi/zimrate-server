/**
 * The rates the calculator holds on the device, plus the per-device state that
 * decides how they are shown.
 *
 * Mirrors the Android app's Room store (RatesModel.save / RatesViewModel): the
 * saved rates are the durable copy the app converts against, and a refresh is
 * something the user asks for rather than something the screen depends on. Held
 * outside React and read synchronously, in the same shape as the site's
 * theme/presetStore, so first render has data with no loading flash.
 *
 * localStorage rather than IndexedDB: this is a few dozen rows, and the
 * synchronous read is what makes an offline cold start instant.
 */
import { DateTime, Duration } from 'luxon';
import { BASE_CURRENCY } from '../currency';

export const AGGREGATES = ['min', 'max', 'mean', 'median', 'mode', 'random'] as const;
export type Aggregate = (typeof AGGREGATES)[number];

/** The app's own default, and the one the Android app ships with. */
export const DEFAULT_AGGREGATE: Aggregate = 'median';

/** How stale saved rates may be before opening the app refreshes them. */
export const STALE_AFTER = Duration.fromObject({ hours: 24 });

export interface StoredRate {
  currency: string;
  rate: number;
  last_rate?: number;
  /** Unix seconds, as the API returns them. */
  last_checked?: number;
  last_updated?: number;
  pinned: boolean;
  hidden: boolean;
  /** Entered by the user rather than returned by the API. A refresh never touches one. */
  custom: boolean;
  /** The user's own label, custom rates only. */
  name?: string;
}

export interface RatesState {
  rates: StoredRate[];
  /** When the rates were last successfully fetched, in ms. */
  fetchedAt: number | null;
  aggregate: Aggregate;
}

const STORAGE_KEY = 'zimrate-calculator';

const EMPTY: RatesState = { rates: [], fetchedAt: null, aggregate: DEFAULT_AGGREGATE };

function load(): RatesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw) as Partial<RatesState>;
    if (!Array.isArray(parsed.rates)) return EMPTY;

    return {
      rates: parsed.rates,
      fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : null,
      aggregate: AGGREGATES.includes(parsed.aggregate as Aggregate)
        ? (parsed.aggregate as Aggregate)
        : DEFAULT_AGGREGATE,
    };
  } catch {
    // Unparseable, or storage unavailable in a private window. Start empty
    // rather than failing to boot — the app has to survive an evicted store.
    return EMPTY;
  }
}

let state: RatesState = load();
const listeners = new Set<() => void>();

function commit(next: RatesState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Over quota or blocked — the in-memory state still stands for this session. */
  }
  listeners.forEach((listener) => listener());
}

export function getRatesState(): RatesState {
  return state;
}

export function subscribeRates(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * USD first, then favourites, then alphabetically. Matches the Android
 * ordering minus its manual sortOrder, which needs drag-to-reorder to be
 * meaningful and is deliberately not implemented here.
 */
export function compareRates(a: StoredRate, b: StoredRate): number {
  if (a.currency !== b.currency) {
    if (a.currency === BASE_CURRENCY) return -1;
    if (b.currency === BASE_CURRENCY) return 1;
  }
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return a.currency.localeCompare(b.currency);
}

// ── User state ────────────────────────────────────────────────────────────────

/** USD is the base: it stays pinned and stays visible. */
export function togglePin(currency: string) {
  if (currency === BASE_CURRENCY) return;
  commit({
    ...state,
    rates: state.rates.map((rate) =>
      rate.currency === currency ? { ...rate, pinned: !rate.pinned } : rate,
    ),
  });
}

export function setHidden(currency: string, hidden: boolean) {
  if (currency === BASE_CURRENCY) return;
  commit({
    ...state,
    rates: state.rates.map((rate) => (rate.currency === currency ? { ...rate, hidden } : rate)),
  });
}

export function currencyExists(currency: string): boolean {
  const code = currency.trim().toUpperCase();
  return state.rates.some((rate) => rate.currency === code);
}

export function addCustomRate(currency: string, name: string, rate: number) {
  const code = currency.trim().toUpperCase();
  if (!code || rate <= 0 || currencyExists(code)) return;

  commit({
    ...state,
    rates: [
      ...state.rates,
      {
        currency: code,
        name: name.trim() || code,
        rate,
        last_rate: rate,
        last_checked: DateTime.now().toUnixInteger(),
        last_updated: DateTime.now().toUnixInteger(),
        pinned: false,
        hidden: false,
        custom: true,
      },
    ],
  });
}

/**
 * A typed rate is normally held in memory and dropped by the next refresh. A
 * custom rate has no server copy to restore it from, so an edit is written back
 * here instead.
 */
export function updateCustomRate(currency: string, rate: number) {
  if (rate <= 0) return;

  commit({
    ...state,
    rates: state.rates.map((existing) =>
      existing.currency === currency && existing.custom
        ? {
            ...existing,
            last_rate: existing.rate,
            rate,
            last_checked: DateTime.now().toUnixInteger(),
            last_updated: DateTime.now().toUnixInteger(),
          }
        : existing,
    ),
  });
}

/** API rates are hidden; a custom rate is removed outright and is not recoverable. */
export function deleteCustomRate(currency: string) {
  commit({
    ...state,
    rates: state.rates.filter((rate) => !(rate.currency === currency && rate.custom)),
  });
}

// ── Fetching ──────────────────────────────────────────────────────────────────

interface ApiRate {
  currency: string;
  rate: number;
  last_rate?: number;
  last_checked?: number;
  last_updated?: number;
}

/**
 * Folds fresh API rates into the saved ones, mirroring RatesModel.save:
 *
 *  - a currency the user defined owns that code outright, so the server never
 *    overwrites it even if it starts quoting it;
 *  - pin and hide state is carried over;
 *  - a synthetic USD base is added on a full refresh only — a single-currency
 *    refresh must not touch USD;
 *  - rates missing from the response are kept, since a single-currency refresh
 *    is not evidence that the rest are gone.
 */
function merge(existing: StoredRate[], incoming: ApiRate[]): StoredRate[] {
  const byCode = new Map(existing.map((rate) => [rate.currency, rate]));

  const rows: ApiRate[] = [...incoming];
  if (rows.length > 1 && !rows.some((row) => row.currency?.toUpperCase() === BASE_CURRENCY)) {
    rows.push({ currency: BASE_CURRENCY, rate: 1, last_rate: 1 });
  }

  for (const row of rows) {
    const code = row.currency?.toUpperCase();
    if (!code || !Number.isFinite(row.rate)) continue;

    const previous = byCode.get(code);
    if (previous?.custom) continue;

    byCode.set(code, {
      currency: code,
      rate: row.rate,
      last_rate: row.last_rate,
      last_checked: row.last_checked,
      last_updated: row.last_updated,
      pinned: code === BASE_CURRENCY ? true : (previous?.pinned ?? false),
      hidden: code === BASE_CURRENCY ? false : (previous?.hidden ?? false),
      custom: false,
    });
  }

  return [...byCode.values()];
}

/**
 * Pulls rates from the REST API and saves them.
 *
 * `prefer` drops `name` and `url` from the response, which is why rows label
 * themselves from the local currency lookup instead. Pass [currency] to refresh
 * a single row.
 *
 * Pass [aggregate] to switch to it. It is saved together with the rates it
 * fetched, so a failed switch leaves the old choice and its rates in place
 * rather than labelling the old rates with the new choice.
 */
export async function refreshRates(
  currency?: string,
  aggregate: Aggregate = state.aggregate,
): Promise<void> {
  const params = new URLSearchParams({ prefer: aggregate, extra: 'true' });
  if (currency) params.set('currency', currency);

  const response = await fetch(`/api/v1?${params}`);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // The API answers 422 for a currency it does not serve.
    throw new Error(body?.message || `Could not reach the rates service (${response.status})`);
  }

  const rows: ApiRate[] = Array.isArray(body?.USD) ? body.USD : [];
  if (rows.length === 0) {
    throw new Error('The rates service returned nothing to update');
  }

  commit({
    ...state,
    rates: merge(state.rates, rows),
    fetchedAt: DateTime.now().toMillis(),
    aggregate,
  });
}

/** True when the saved rates are old enough that opening the app should refresh. */
export function isStale(): boolean {
  return state.fetchedAt === null
    || DateTime.fromMillis(state.fetchedAt) < DateTime.now().minus(STALE_AFTER);
}
