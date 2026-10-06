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

// A class rather than an object of factories: toFirestore() branches on
// `instanceof Timestamp`, which throws outright on a plain object, so writing a
// new rate was untestable here.
vi.mock('firebase-admin/firestore', () => {
    class Timestamp {
        constructor(date) { this.date = date; }
        toDate() { return this.date; }
        toMillis() { return this.date?.getTime?.() ?? 0; }
        static now() { return new Timestamp(new Date()); }
        static fromDate(d) { return new Timestamp(d); }
        static fromMillis(ms) { return new Timestamp(new Date(ms)); }
    }
    return { getFirestore: vi.fn(), Timestamp };
});
vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));
// The window settings are read through the options collection and cached in the
// RTDB. Both stubs miss, so every test here runs on the built-in defaults.
vi.mock('firebase-admin/database', () => {
    const ref = {
        get: vi.fn(async () => ({ exists: () => false, child: () => ({ val: () => null }), val: () => null })),
        set: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
    };
    return { getDatabase: vi.fn(() => ({ ref: vi.fn(() => ref) })) };
});

import { getFirestore } from 'firebase-admin/firestore';
import Rate, { labelKey } from '../models/Rate.js';

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
    // Unseen for longer than the freshness window, but still inside the retention
    // one — only the "updated" scope's absence should surface it
    {
        id: 'zwg-stale', rate_currency: 'ZWG', rate_name: 'Abandoned - ZWG', source_id: 'source6',
        source_url: 'https://gone.co.zw', rate: 99.0, last_rate: 99.0, enabled: true,
        updated_at: ago({ months: 6 }), rate_updated_at: ago({ months: 6 })
    },
    // Past the retention window, and belongs to the source the sweep tests scrape.
    // A currency of its own, so lifting the freshness scope does not change the
    // ZWG set the aggregate tests are counting.
    {
        id: 'zmw-ancient', rate_currency: 'ZMW', rate_name: 'RBZ - ZMW', source_id: 'source1',
        source_url: 'https://rbz.co.zw', rate: 12.0, last_rate: 12.0, enabled: true,
        updated_at: ago({ months: 13 }), rate_updated_at: ago({ months: 13 })
    },
    {
        id: 'zwg-off', rate_currency: 'ZWG', rate_name: 'Disabled - ZWG', source_id: 'source7',
        source_url: 'https://off.co.zw', rate: 55.0, last_rate: 55.0, enabled: false,
        updated_at: ago({ hours: 1 }), rate_updated_at: ago({ hours: 1 })
    }
];

/** Every source the fixtures name, enabled, plus one switched off. */
const SOURCES = [
    ...['source1', 'source2', 'source3', 'source4', 'source5', 'source6', 'source7', 'new', 'noisy', 'cabs']
        .map(id => ({ id, enabled: true })),
    { id: 'source-off', enabled: false },
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
            // The document itself rides along on the ref so a committed batch can
            // write back to it. upsertFromScrape commits its renames and then
            // queries for the new names, which a write-only mock never returns.
            ref: { id: d.id, doc: d }
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

/** Batch writes land on the documents, so a later read in the same call sees them. */
function makeBatch() {
    return {
        set: vi.fn((ref, data) => batched.set.push({ id: ref.id, data })),
        update: vi.fn((ref, data) => {
            batched.update.push({ id: ref.id, data });
            if (ref.doc) Object.assign(ref.doc, data);
        }),
        delete: vi.fn(ref => batched.deleted.push(ref.id)),
        commit: vi.fn().mockResolvedValue(undefined)
    };
}

beforeEach(() => {
    batched = { set: [], update: [], deleted: [] };

    // Copied per test: writes now mutate the documents, and the fixtures are
    // shared, so a test that scrapes must not leave its edits for the next one.
    const live = RATES.map(r => ({ ...r }));

    vi.mocked(getFirestore).mockReturnValue({
        collection: vi.fn(name => (name === 'sources' ? makeQuery(SOURCES) : makeQuery(live))),
        batch: vi.fn(makeBatch)
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

    it('updated: excludes rates not seen within the freshness window', async () => {
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
        vi.mocked(getFirestore).mockReturnValue({ collection: vi.fn(name => (name === 'sources' ? makeQuery(SOURCES) : makeQuery(repeated))) });

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

    // The ZWG consensus is near 29; a factor of 2 accepts 14.5 … 58.
    it('accepts a value within the tolerance, however far apart real rates are', () => {
        expect(Rate.screenRate(27, 29)).toBe(27);
        // The cash rate sits well above the official one, and is real.
        expect(Rate.screenRate(40, 29)).toBe(40);
    });

    it('corrects a value read in cents', () => {
        expect(Rate.screenRate(2900, 29)).toBe(29);
    });

    it('refuses a value that is wrong even after the cents correction', () => {
        expect(Rate.screenRate(50000, 29)).toBeNull();
        expect(Rate.screenRate(0.4, 29)).toBeNull();
        // FBC's RTGS$ figure, read as ZWG
        expect(Rate.screenRate(405.88, 29)).toBeNull();
    });

    it('refuses a rate quoted the wrong way up', () => {
        // CABS: EUR 1.0868 is USD per EUR. Within a factor of 2 of the EUR
        // consensus, but its inverse, 0.92, is closer still.
        expect(Rate.screenRate(1.0868, 0.868)).toBeNull();
        expect(Rate.screenRate(0.0665, 13.44)).toBeNull();  // BWP
        expect(Rate.screenRate(0.893, 0.868)).toBe(0.893);  // EUR the right way up
    });

    it('does not suspect an inversion near parity', () => {
        // 1.02 and its inverse 0.98 are both near a 0.99 consensus.
        expect(Rate.screenRate(1.02, 0.99)).toBe(1.02);
    });

    it('accepts anything for a currency with nothing to compare against', () => {
        expect(Rate.screenRate(5000, undefined)).toBe(5000);
    });

    it('takes the consensus from the other sources\' medians', async () => {
        const consensus = await Rate.consensus('source1');

        // source1's own 26.5 is left out: the median of 28, 30 and 32.
        expect(consensus.ZWG).toBe(30);
        expect(consensus.ZAR).toBe(18.5);
        // Stale and disabled rates never count.
        expect((await Rate.consensus()).ZWG).toBe(29);
    });

    it('gives a source one vote however many rows it quotes', async () => {
        const many = [
            ...RATES,
            ...[90, 91, 92, 93, 94].map((rate, i) => ({
                ...RATES[0], id: `noisy-${i}`, source_id: 'noisy', rate_name: `Noisy - ${i}`, rate
            }))
        ];
        vi.mocked(getFirestore).mockReturnValue({ collection: vi.fn(name => (name === 'sources' ? makeQuery(SOURCES) : makeQuery(many))) });

        // Sources at 26.5, 28, 30, 32 and 92: the median is 30, not dragged to 90.
        expect((await Rate.consensus()).ZWG).toBe(30);
    });
});

// =============================================================================
// Probation
// =============================================================================

describe('probation', () => {

    const onProbation = {
        id: 'zwg-new', rate_currency: 'ZWG', rate_name: 'New - ZWG', source_id: 'new',
        // 33: above every served ZWG rate, so the max and the consensus both
        // show whether it was counted.
        source_url: 'https://new.co.zw', rate: 33, last_rate: 33, enabled: true, probation: true,
        updated_at: ago({ minutes: 5 }), rate_updated_at: ago({ minutes: 5 })
    };

    beforeEach(() => {
        vi.mocked(getFirestore).mockReturnValue({
            collection: vi.fn(name => (name === 'sources' ? makeQuery(SOURCES) : makeQuery([...RATES, onProbation]))),
            batch: vi.fn(makeBatch)
        });
    });

    it('keeps a source on probation out of what the API serves', async () => {
        expect(idsOf(await Rate.findAll({ enabled: true }))).not.toContain('zwg-new');
        expect(await Rate.getAggregatedRates('max', { enabled: true }))
            .toContainEqual(expect.objectContaining({ rate_currency: 'ZWG', rate: 32 }));
    });

    it('keeps it out of the consensus', async () => {
        expect((await Rate.consensus()).ZWG).toBe(29);
    });

    it('writes the source\'s probation onto every rate it scrapes', async () => {
        await Rate.upsertFromScrape(
            { id: 'new', name: 'New', url: 'https://new.co.zw', probation: true },
            [{ currency: 'ZWG', rate: 30 }, { currency: 'ZAR', rate: 18.4 }]
        );

        expect(batched.update.find(u => u.id === 'zwg-new').data.probation).toBe(true);
        expect(batched.set[0].data.probation).toBe(true);
    });

    it('writes trusted sources\' rates as not on probation', async () => {
        await Rate.upsertFromScrape({ id: 'source1', name: 'RBZ', url: 'https://rbz.co.zw' }, [{ currency: 'ZWG', rate: 26.6 }]);

        expect(batched.update.find(u => u.id === 'zwg-rbz').data.probation).toBe(false);
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

// =============================================================================
// upsertFromScrape rename reconciliation
// =============================================================================

describe('upsertFromScrape renames', () => {

    const SOURCE = { id: 'source1', name: 'RBZ', url: 'https://rbz.co.zw' };

    it('relabels a stored rate when the page reworded its row', async () => {
        // The label belongs to the source's editors: 'RBZ - ZWG' becoming
        // 'RBZ - Official' is the same rate renamed, not a new one.
        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 26.6, name: 'Official' }]);

        expect(batched.update).toContainEqual(
            expect.objectContaining({ id: 'zwg-rbz', data: { rate_name: 'RBZ - Official' } })
        );
    });

    it('keeps the rate on its existing record rather than starting a new one', async () => {
        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 26.6, name: 'Official' }]);

        // A new document here would mean the reading lost its history.
        expect(batched.set).toHaveLength(0);
        expect(batched.update.some(u => u.id === 'zwg-rbz' && u.data.rate === 26.6)).toBe(true);
    });

    it('does not guess when more than one rate is unaccounted for', async () => {
        // Two stored ZWG names for this source and two unmatched arrivals: which
        // became which is unknowable, so nothing is relabelled.
        const two = [...RATES, {
            id: 'zwg-rbz-2', rate_currency: 'ZWG', rate_name: 'RBZ - Interbank', source_id: 'source1',
            source_url: 'https://rbz.co.zw', rate: 27.0, last_rate: 27.0, enabled: true,
            updated_at: ago({ hours: 1 }), rate_updated_at: ago({ hours: 1 })
        }];
        vi.mocked(getFirestore).mockReturnValue({
            collection: vi.fn(name => (name === 'sources' ? makeQuery(SOURCES) : makeQuery(two))),
            batch: vi.fn(makeBatch)
        });

        await Rate.upsertFromScrape(SOURCE, [
            { currency: 'ZWG', rate: 26.6, name: 'Official' },
            { currency: 'ZWG', rate: 27.1, name: 'Cash Rate' }
        ]);

        const relabels = batched.update.filter(u => u.data.rate_name);
        expect(relabels).toHaveLength(0);
    });
});

// =============================================================================
// upsertFromScrape retention sweep
// =============================================================================

describe('upsertFromScrape retention', () => {

    const SOURCE = { id: 'source1', name: 'RBZ', url: 'https://rbz.co.zw' };

    // A scrape of this source that no longer lists ZWG at all.
    const scrapeWithoutZwg = () => Rate.upsertFromScrape(SOURCE, [{ currency: 'ZAR', rate: 18.6 }]);

    it('keeps a rate the source has stopped listing', async () => {
        await scrapeWithoutZwg();

        // One absence proves nothing: a truncated page or a missed extraction
        // looks identical to a delisting, and deleting would take last_rate with it.
        expect(batched.deleted).not.toContain('zwg-rbz');
    });

    it('deletes a rate unseen for longer than the retention window', async () => {
        await scrapeWithoutZwg();

        expect(batched.deleted).toContain('zmw-ancient');
    });

    it('leaves a rate that is merely stale in place', async () => {
        await scrapeWithoutZwg();

        // Six months: out of the API, but well inside the year it is kept for.
        expect(batched.deleted).not.toContain('zwg-stale');
    });
});

// =============================================================================
// Label keys — matching a row to its record despite the model's label drift
// =============================================================================

describe('labelKey', () => {

    it.each([
        // One CABS row, as the model labelled it on successive runs
        ['ZiG USD Buy Cash', 'USD ZiG Buy Cash', 'ZiG Buy Cash', 'USD Buy Cash', 'Buy Cash'],
        // Zim Price Check rows that gained a currency suffix
        ['cash rate', 'cash rate ZiG'],
        ['Maximum rate businesses can use', 'Maximum rate businesses can use ZiG'],
    ])('gives every wording of one row the same key: %s', (...labels) => {
        const keys = labels.map(label => labelKey(label, 'ZWG'));
        expect(new Set(keys).size).toBe(1);
    });

    it('keeps genuinely different rows apart', () => {
        const labels = ['Buy', 'Buy Cash', 'Sell', 'Sell Cash', 'Street Value (Sell USD)', 'Street Cost (Buy USD)',
            'lowest informal-sector rate', 'highest informal-sector rate', 'OK Supermarket', 'Pick N Pay'];
        const keys = labels.map(label => labelKey(label, 'ZWG'));
        expect(new Set(keys).size).toBe(labels.length);
    });

    it('reduces a label that is only a currency to the same key as no label', () => {
        // A rate stored without a label of its own is named after its currency.
        expect(labelKey('ZWG', 'ZWG')).toBe('');
        expect(labelKey('ZiG', 'ZWG')).toBe('');
        expect(labelKey(null, 'ZWG')).toBe('');
        expect(labelKey('ZAR', 'ZAR')).toBe('');
    });
});

describe('upsertFromScrape label drift', () => {

    const SOURCE = { id: 'cabs', name: 'CABS', url: 'https://www.cabs.co.zw/exchange-rates' };

    const stored = (id, name, rate, hoursAgo) => ({
        id, rate_currency: 'ZWG', rate_name: `CABS - ${name}`, source_id: 'cabs',
        source_url: SOURCE.url, rate, last_rate: rate, enabled: true,
        updated_at: ago({ hours: hoursAgo }), rate_updated_at: ago({ hours: hoursAgo })
    });

    const useRates = (rates) => vi.mocked(getFirestore).mockReturnValue({
        collection: vi.fn(name => (name === 'sources' ? makeQuery(SOURCES) : makeQuery(rates))),
        batch: vi.fn(makeBatch)
    });

    it('updates the stored rate when the row comes back reworded', async () => {
        useRates([...RATES, stored('buy-cash', 'Buy Cash', 25.90674, 1)]);

        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 25.9, name: 'ZiG USD Buy Cash' }]);

        expect(batched.set).toHaveLength(0);
        expect(batched.update).toContainEqual(
            expect.objectContaining({ id: 'buy-cash', data: expect.objectContaining({ rate: 25.9 }) })
        );
        // Matched, not renamed: the stored label stays put.
        expect(batched.update.some(u => u.data.rate_name)).toBe(false);
    });

    it('merges stored duplicates into the most recently seen one', async () => {
        useRates([
            ...RATES,
            stored('old', 'USD ZiG Buy Cash', 25.90674, 5),
            stored('newest', 'Buy Cash', 25.90674, 1),
            stored('older', 'ZiG Buy Cash', 25.907, 3),
            stored('sell', 'Sell', 27.47253, 1),
        ]);

        const results = await Rate.upsertFromScrape(SOURCE, [
            { currency: 'ZWG', rate: 25.90674, name: 'USD Buy Cash' },
            { currency: 'ZWG', rate: 27.47253, name: 'Sell' },
        ]);

        expect(batched.deleted.sort()).toEqual(['old', 'older']);
        expect(results.filter(r => r.action === 'merged')).toHaveLength(2);
        expect(batched.update.map(u => u.id).sort()).toEqual(['newest', 'sell']);
        expect(batched.set).toHaveLength(0);
    });

    it('collapses one row returned twice in the same scrape', async () => {
        useRates([...RATES]);

        await Rate.upsertFromScrape(SOURCE, [
            { currency: 'ZWG', rate: 25.974, name: 'ZiG Buy' },
            { currency: 'ZWG', rate: 25.974, name: 'USD Buy' },
        ]);

        expect(batched.set).toHaveLength(1);
    });
});

// =============================================================================
// Disabled and deleted sources
// =============================================================================

describe('rates of a source that is switched off', () => {

    const rate = (id, source_id, rate_currency = 'ZWG') => ({
        id, rate_currency, rate_name: id, source_id, source_url: '', rate: 99, last_rate: 99,
        enabled: true, updated_at: ago({ minutes: 5 }), rate_updated_at: ago({ minutes: 5 })
    });

    beforeEach(() => {
        vi.mocked(getFirestore).mockReturnValue({
            collection: vi.fn(name => (name === 'sources' ? makeQuery(SOURCES) : makeQuery([
                ...RATES,
                rate('from-off', 'source-off'),
                rate('from-deleted', 'gone-source'),
                rate('by-hand', null),
                rate('only-off', 'source-off', 'GBP'),
            ]))),
            batch: vi.fn(makeBatch)
        });
    });

    it('are not served, nor are those of a deleted source', async () => {
        const ids = idsOf(await Rate.findAll({ enabled: true }));

        expect(ids).not.toContain('from-off');
        expect(ids).not.toContain('from-deleted');
    });

    it('do not hide a rate added by hand, which has no source', async () => {
        expect(idsOf(await Rate.findAll({ enabled: true }))).toContain('by-hand');
    });

    it('do not count towards the currencies served', async () => {
        expect(await Rate.getUniqueCurrencies()).not.toContain('GBP');
    });
});

// =============================================================================
// Sudden jumps and the consensus window
// =============================================================================

describe('upsertFromScrape jumps', () => {

    const SOURCE = { id: 'zpc', name: 'Zim price check', url: 'https://zimpricecheck.com' };

    const cash = (extra = {}) => ({
        id: 'cash', rate_currency: 'ZWG', rate_name: 'Zim price check - cash rate', source_id: 'zpc',
        source_url: SOURCE.url, rate: 40, last_rate: 40, enabled: true,
        updated_at: ago({ hours: 1 }), rate_updated_at: ago({ hours: 1 }), ...extra
    });

    const useRates = (rates) => vi.mocked(getFirestore).mockReturnValue({
        collection: vi.fn(name => (name === 'sources' ? makeQuery([...SOURCES, { id: 'zpc', enabled: true }]) : makeQuery(rates))),
        batch: vi.fn(makeBatch)
    });

    it('holds back a value that jumps, keeping the stored one', async () => {
        // The cash rate, mislabelled with the inverted official rate.
        useRates([...RATES, cash()]);

        const results = await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 26.737968, name: 'cash rate' }]);

        expect(results).toContainEqual({ action: 'held', currency: 'ZWG' });
        expect(batched.update).toEqual([{ id: 'cash', data: { pending_rate: 26.737968 } }]);
    });

    it('stores the jump once the next scrape confirms it', async () => {
        useRates([...RATES, cash({ pending_rate: 30 })]);

        const results = await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 30.1, name: 'cash rate' }]);

        expect(results).toContainEqual({ action: 'updated', currency: 'ZWG' });
        expect(batched.update[0].data).toMatchObject({ rate: 30.1, last_rate: 40, pending_rate: null });
    });

    it('holds again when the next scrape disagrees with the held value', async () => {
        useRates([...RATES, cash({ pending_rate: 26.737968 })]);

        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 31, name: 'cash rate' }]);

        expect(batched.update).toEqual([{ id: 'cash', data: { pending_rate: 31 } }]);
    });

    it('stores an ordinary move at once, and clears a stale held value', async () => {
        useRates([...RATES, cash({ pending_rate: 26.737968 })]);

        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 40, name: 'cash rate' }]);

        expect(batched.update[0].data).toMatchObject({ rate: 40, pending_rate: null });
    });
});

describe('consensus window', () => {

    it('ignores rates not scraped in the last 48 hours', async () => {
        vi.mocked(getFirestore).mockReturnValue({
            collection: vi.fn(name => (name === 'sources' ? makeQuery(SOURCES) : makeQuery([
                ...RATES,
                // CABS's EUR, stored the wrong way up and frozen since.
                { ...RATES[0], id: 'eur-frozen', rate_currency: 'EUR', source_id: 'source2', rate: 1.0868,
                    updated_at: ago({ days: 3 }) },
                { ...RATES[0], id: 'eur-live', rate_currency: 'EUR', source_id: 'source3', rate: 0.868,
                    updated_at: ago({ hours: 1 }) },
            ])))
        });

        expect((await Rate.consensus()).EUR).toBe(0.868);
    });
});

// =============================================================================
// Rates a successfully scraped source no longer returns
// =============================================================================

describe('rates missing from a source that scrapes fine', () => {

    const rate = (id, hoursAgo) => ({
        id, rate_currency: 'ZWG', rate_name: id, source_id: 'site', source_url: '', rate: 30, last_rate: 30,
        enabled: true, updated_at: ago({ hours: hoursAgo }), rate_updated_at: ago({ hours: hoursAgo })
    });

    const withSource = (lastSuccess) => vi.mocked(getFirestore).mockReturnValue({
        collection: vi.fn(name => (name === 'sources'
            ? makeQuery([...SOURCES, { id: 'site', enabled: true, last_success: lastSuccess }])
            : makeQuery([...RATES, rate('renamed-away', 30), rate('missed-a-few', 5), rate('current', 0.1)]))),
        batch: vi.fn(makeBatch)
    });

    it('stop being served after a day of successful scrapes without them', async () => {
        withSource(ago({ minutes: 5 }));
        const ids = idsOf(await Rate.findAll({ enabled: true }));

        expect(ids).not.toContain('renamed-away');
        expect(ids).toContain('missed-a-few');
        expect(ids).toContain('current');
    });

    it('are kept while their source is failing', async () => {
        // Last success two days ago: nothing since says the row has gone.
        withSource(ago({ days: 2 }));

        expect(idsOf(await Rate.findAll({ enabled: true }))).toContain('renamed-away');
    });

    it('are kept for a source with no successful scrape on record', async () => {
        withSource(undefined);

        expect(idsOf(await Rate.findAll({ enabled: true }))).toContain('renamed-away');
    });

    it('do not count towards the currencies served', async () => {
        vi.mocked(getFirestore).mockReturnValue({
            collection: vi.fn(name => (name === 'sources'
                ? makeQuery([...SOURCES, { id: 'site', enabled: true, last_success: ago({ minutes: 5 }) }])
                : makeQuery([...RATES, { ...rate('renamed-away', 30), rate_currency: 'GBP' }]))),
        });

        expect(await Rate.getUniqueCurrencies()).not.toContain('GBP');
    });
});
