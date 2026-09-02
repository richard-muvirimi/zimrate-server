/**
 * Rate model unit tests — mirrors the legacy PHP RateScopeTest, plus the value
 * screening and median rules that came back from the Laravel scraper.
 *
 * api.test.js drives the HTTP surface through a Firestore mock that deliberately
 * ignores where() clauses. These tests are about the queries themselves, so the
 * mock here actually applies them.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(),
    Timestamp: {
        now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
        fromDate: vi.fn(d => ({ toDate: () => d, toMillis: () => (d?.getTime?.() ?? 0) })),
        fromMillis: vi.fn(ms => ({ toDate: () => new Date(ms), toMillis: () => ms }))
    }
}));
vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

import { getFirestore } from 'firebase-admin/firestore';
import Rate from '../models/Rate.js';

// ── Test data ─────────────────────────────────────────────────────────────────

const ago = (opts) => DateTime.now().minus(opts).toJSDate();

/**
 * Four fresh ZWG rates (26.5 / 28 / 30 / 32) so an even-sized median has two
 * middle values to average, one ZAR rate, plus a stale and a disabled record for
 * the scopes that are supposed to exclude them.
 */
const RATES = [
    {
        id: 'zwg-rbz', rate_currency: 'ZWG', rate_name: 'RBZ - ZWG', source_id: 'source1',
        source_url: 'https://rbz.co.zw', rate: 26.5, last_rate: 26.0, enabled: true,
        updated_at: ago({ hours: 1 }), rate_updated_at: ago({ hours: 3 })
    },
    {
        id: 'zwg-market', rate_currency: 'ZWG', rate_name: 'Black Market - ZWG', source_id: 'source2',
        source_url: 'https://zimpricecheck.com', rate: 28.0, last_rate: 27.5, enabled: true,
        updated_at: ago({ minutes: 30 }), rate_updated_at: ago({ minutes: 20 })
    },
    {
        id: 'zwg-bank', rate_currency: 'ZWG', rate_name: 'Bank - ZWG', source_id: 'source3',
        source_url: 'https://bank.co.zw', rate: 30.0, last_rate: 29.0, enabled: true,
        updated_at: ago({ hours: 2 }), rate_updated_at: ago({ hours: 4 })
    },
    {
        id: 'zwg-kiosk', rate_currency: 'ZWG', rate_name: 'Kiosk - ZWG', source_id: 'source4',
        source_url: 'https://kiosk.co.zw', rate: 32.0, last_rate: 31.0, enabled: true,
        updated_at: ago({ hours: 3 }), rate_updated_at: ago({ hours: 5 })
    },
    {
        id: 'zar-rbz', rate_currency: 'ZAR', rate_name: 'RBZ - ZAR', source_id: 'source5',
        source_url: 'https://rbz.co.zw', rate: 18.5, last_rate: 18.2, enabled: true,
        updated_at: ago({ hours: 1 }), rate_updated_at: ago({ hours: 3 })
    },
    // Not scraped in a fortnight — only the "updated" scope's absence should surface it
    {
        id: 'zwg-stale', rate_currency: 'ZWG', rate_name: 'Abandoned - ZWG', source_id: 'source6',
        source_url: 'https://gone.co.zw', rate: 99.0, last_rate: 99.0, enabled: true,
        updated_at: ago({ days: 14 }), rate_updated_at: ago({ days: 14 })
    },
    {
        id: 'zwg-off', rate_currency: 'ZWG', rate_name: 'Disabled - ZWG', source_id: 'source7',
        source_url: 'https://off.co.zw', rate: 55.0, last_rate: 55.0, enabled: false,
        updated_at: ago({ hours: 1 }), rate_updated_at: ago({ hours: 1 })
    }
];

// ── Firestore mock that honours where() ───────────────────────────────────────

/** Dates, Timestamps and plain values all reduced to something comparable. */
function comparable(value) {
    if (value instanceof Date) return value.getTime();
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();
    return value;
}

function snapshotOf(docs) {
    return {
        docs: docs.map(d => ({
            id: d.id,
            exists: true,
            data: () => ({ ...d }),
            ref: { id: d.id }
        })),
        empty: docs.length === 0
    };
}

function makeQuery(docs, clauses = [], take = null) {
    const query = {
        where: (field, op, value) => makeQuery(docs, [...clauses, { field, op, value }], take),
        limit: (n) => makeQuery(docs, clauses, n),
        orderBy: () => query,   // findAll re-sorts in memory
        select: () => query,
        doc: () => ({ id: 'new-doc' }),
        get: async () => {
            const matched = docs.filter(doc => clauses.every(({ field, op, value }) => {
                const actual = comparable(doc[field]);
                const expected = comparable(value);
                return op === '>' ? actual > expected : actual === expected;
            }));
            return snapshotOf(take === null ? matched : matched.slice(0, take));
        }
    };
    return query;
}

let batched;

beforeEach(() => {
    batched = { set: [], update: [], deleted: [] };

    vi.mocked(getFirestore).mockReturnValue({
        collection: vi.fn(() => makeQuery(RATES)),
        batch: vi.fn(() => ({
            set: vi.fn((ref, data) => batched.set.push({ id: ref.id, data })),
            update: vi.fn((ref, data) => batched.update.push({ id: ref.id, data })),
            delete: vi.fn(ref => batched.deleted.push(ref.id)),
            commit: vi.fn().mockResolvedValue(undefined)
        }))
    });
});

const idsOf = (rates) => rates.map(r => r.id).sort();

// =============================================================================
// Query scopes  (RateScopeTest)
// =============================================================================

describe('scopes', () => {

    it('enabled: excludes disabled rates', async () => {
        const rates = await Rate.findAll({ enabled: true });

        expect(idsOf(rates)).not.toContain('zwg-off');
        expect(rates.every(r => r.enabled)).toBe(true);
    });

    it('updated: excludes rates not checked within the last week', async () => {
        const rates = await Rate.findAll({ enabled: true });

        expect(idsOf(rates)).not.toContain('zwg-stale');
        expect(idsOf(rates)).toEqual(['zar-rbz', 'zwg-bank', 'zwg-kiosk', 'zwg-market', 'zwg-rbz']);
    });

    it('updated: applyUpdatedScope false lets stale rates through', async () => {
        const rates = await Rate.findAll({ enabled: true, applyUpdatedScope: false });

        expect(idsOf(rates)).toContain('zwg-stale');
    });

    it('search: matches on rate name, case insensitively', async () => {
        const rates = await Rate.findAll({ enabled: true, search: 'black' });

        expect(idsOf(rates)).toEqual(['zwg-market']);
    });

    it('date: keeps only rates whose value moved after the given timestamp', async () => {
        const anHourAgo = DateTime.now().minus({ hours: 1 }).toUnixInteger();
        const rates = await Rate.findAll({ enabled: true, dateAfter: anHourAgo });

        expect(idsOf(rates)).toEqual(['zwg-market']);
    });

    it('currency: matches uppercased, so a lowercase code still works', async () => {
        const rates = await Rate.findAll({ enabled: true, currency: 'zwg' });

        expect(rates).toHaveLength(4);
        expect(rates.every(r => r.rate_currency === 'ZWG')).toBe(true);
    });
});

// =============================================================================
// Aggregates  (the `preferred` scope)
// =============================================================================

describe('getAggregatedRates', () => {

    const zwgRate = (rates) => rates.find(r => r.rate_currency === 'ZWG').rate;

    it.each([
        ['min', 26.5],
        ['max', 32],
        ['mean', 29.125],
        ['median', 29],   // (28 + 30) / 2 — an even split averages, it does not round up
        ['mode', 28]      // no value repeats, so the tie falls to the most recently updated
    ])('prefer=%s returns %s for ZWG', async (prefer, expected) => {
        const rates = await Rate.getAggregatedRates(prefer, { enabled: true });

        expect(zwgRate(rates)).toBeCloseTo(expected, 5);
    });

    it('returns exactly one rate per currency', async () => {
        for (const prefer of ['min', 'max', 'mean', 'median', 'mode', 'random']) {
            const rates = await Rate.getAggregatedRates(prefer, { enabled: true });
            const currencies = rates.map(r => r.rate_currency);

            expect(currencies.sort()).toEqual(['ZAR', 'ZWG']);
        }
    });

    it('mode picks the repeated value, not the most recent one', async () => {
        const repeated = [
            { ...RATES[0], id: 'a', rate: 26.5, updated_at: ago({ minutes: 5 }) },
            { ...RATES[0], id: 'b', rate: 30.0, updated_at: ago({ hours: 2 }) },
            { ...RATES[0], id: 'c', rate: 30.0, updated_at: ago({ hours: 3 }) }
        ];
        vi.mocked(getFirestore).mockReturnValue({ collection: vi.fn(() => makeQuery(repeated)) });

        const rates = await Rate.getAggregatedRates('mode', { enabled: true });

        expect(zwgRate(rates)).toBe(30);
    });

    it('median takes the middle value on an odd-sized group', async () => {
        // Dropping the week window adds the stale 99, making five ZWG values
        // (26.5, 28, 30, 32, 99) with a true middle.
        const rates = await Rate.getAggregatedRates('median', { enabled: true, applyUpdatedScope: false });

        expect(zwgRate(rates)).toBe(30);
    });
});

// =============================================================================
// Value screening
// =============================================================================

describe('screenRate', () => {

    const band = { min: 26.5, max: 32 };   // accepts 18.55 … 41.6

    it('accepts a value inside the band', () => {
        expect(Rate.screenRate(27, band)).toBe(27);
    });

    it('corrects a value read in cents', () => {
        expect(Rate.screenRate(2900, band)).toBe(29);
    });

    it('refuses a value that is wrong even after the cents correction', () => {
        expect(Rate.screenRate(50000, band)).toBeNull();
        expect(Rate.screenRate(0.4, band)).toBeNull();
    });

    it('accepts anything for a currency with nothing to compare against', () => {
        expect(Rate.screenRate(5000, undefined)).toBe(5000);
    });

    it('builds a band per currency from the rates being served', async () => {
        const bands = await Rate.currencyBands();

        expect(bands.ZWG).toEqual({ min: 26.5, max: 32 });
        expect(bands.ZAR).toEqual({ min: 18.5, max: 18.5 });
    });
});

// =============================================================================
// upsertFromScrape screening
// =============================================================================

describe('upsertFromScrape screening', () => {

    const SOURCE = { id: 'source1', name: 'RBZ', url: 'https://rbz.co.zw' };

    it('stores the corrected value when a source publishes cents', async () => {
        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 2900 }]);

        expect(batched.update).toHaveLength(1);
        expect(batched.update[0].data.rate).toBe(29);
    });

    it('writes nothing for an implausible reading', async () => {
        const results = await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 50000 }]);

        expect(batched.update).toHaveLength(0);
        expect(batched.set).toHaveLength(0);
        expect(results).toContainEqual({ action: 'rejected', currency: 'ZWG' });
    });

    it('does not let a refused reading delete the rate it could not update', async () => {
        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 50000 }]);

        expect(batched.deleted).not.toContain('zwg-rbz');
    });
});
