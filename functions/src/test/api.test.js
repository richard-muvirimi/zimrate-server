/**
 * API contract tests — mirrors the legacy PHP test suite (ApiVersion0Test, ApiVersion1Test, ApiGraphqlTest).
 * Uses vitest + supertest against a real Express app with mocked Firebase services.
 */
import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import supertest from 'supertest';
import express from 'express';
import cors from 'cors';

// ── Firebase mocks (hoisted before imports) ───────────────────────────────────
vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({
    getAuth: vi.fn(() => ({
        verifyIdToken: vi.fn(),
        listUsers: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),
        setCustomUserClaims: vi.fn()
    }))
}));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(),
    Timestamp: {
        now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
        fromDate: vi.fn(d => ({ toDate: () => d, toMillis: () => (d?.getTime?.() ?? 0) })),
        fromMillis: vi.fn(ms => ({ toDate: () => new Date(ms), toMillis: () => ms }))
    }
}));
vi.mock('firebase-admin/database', () => {
    const snapshot = {
        exists: () => false,
        child: () => ({ val: () => null }),
        val: () => null,
        forEach: () => {}
    };
    const ref = {
        get: vi.fn(async () => snapshot),
        set: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
        update: vi.fn(async () => {}),
        orderByChild: vi.fn(function() { return this; }),
        endAt: vi.fn(function() { return this; }),
    };
    return { getDatabase: vi.fn(() => ({ ref: vi.fn(() => ref) })) };
});
vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    setGlobalOptions: vi.fn()
}));

import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import apiRoutes from '../routes/api.js';
import Rate from '../models/Rate.js';
import { rateQuerySchema } from '../validation/schemas.js';
import { errorHandler } from '../middleware/error.js';

// ── Test data ─────────────────────────────────────────────────────────────────

const TEST_INFO = 'ZimRate API - Real-time Zimbabwe exchange rates';

/**
 * Three realistic rates:
 *  - ZWG and ZAR from RBZ (same source)
 *  - ZWG from a black market source
 * All are enabled and freshly scraped.
 *
 * Timestamps are relative to now, not absolute: written as fixed dates they aged
 * past the freshness window as the calendar moved, and every rate quietly became
 * one the API would refuse to serve.
 */
const ago = (opts) => DateTime.now().minus(opts).toJSDate();
const TEST_RATES = [
    {
        id: 'rate1',
        rate_currency: 'ZWG',
        rate_name: 'RBZ - ZWG',
        source_url: 'https://rbz.co.zw',
        source_id: 'source1',
        rate: 26.5,
        last_rate: 26.0,
        enabled: true,
        updated_at: ago({ hours: 25 }),
        rate_updated_at: ago({ hours: 26 }),
        created_at: new Date('2026-01-01T00:00:00Z'),
        javascript: false,
        rate_selector: '',
        rate_updated_at_selector: '',
        source_timezone: 'UTC'
    },
    {
        id: 'rate2',
        rate_currency: 'ZAR',
        rate_name: 'RBZ - ZAR',
        source_url: 'https://rbz.co.zw',
        source_id: 'source1',
        rate: 18.5,
        last_rate: 18.2,
        enabled: true,
        updated_at: ago({ hours: 25 }),
        rate_updated_at: ago({ hours: 26 }),
        created_at: new Date('2026-01-01T00:00:00Z'),
        javascript: false,
        rate_selector: '',
        rate_updated_at_selector: '',
        source_timezone: 'UTC'
    },
    {
        id: 'rate3',
        rate_currency: 'ZWG',
        rate_name: 'Black Market - ZWG',
        source_url: 'https://zimpricecheck.com',
        source_id: 'source2',
        rate: 28.0,
        last_rate: 27.5,
        enabled: true,
        updated_at: ago({ hours: 1 }),
        rate_updated_at: ago({ hours: 3 }),
        created_at: new Date('2026-01-01T00:00:00Z'),
        javascript: false,
        rate_selector: '',
        rate_updated_at_selector: '',
        source_timezone: 'UTC'
    }
];

const TEST_OPTIONS = [
    { id: 'opt1', key: 'info', value: TEST_INFO }
];

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeSnapshot(docs) {
    return {
        docs: docs.map(d => ({
            id: d.id,
            exists: true,
            data: () => ({ ...d }),
            ref: { id: d.id, update: vi.fn(), delete: vi.fn() }
        })),
        empty: docs.length === 0
    };
}

/**
 * Returns a chainable Firestore query mock.
 * All filter/sort calls are ignored — the snapshot is always the full dataset.
 * This replicates how Firestore deduplication in findAll() works (Map by doc.id).
 */
function makeChainableQuery(snapshot) {
    const q = {
        where: vi.fn(() => q),
        orderBy: vi.fn(() => q),
        limit: vi.fn(() => q),
        select: vi.fn(() => q),
        doc: vi.fn(id => ({
            get: vi.fn().mockResolvedValue({
                exists: snapshot.docs.some(d => d.id === id),
                id,
                data: () => snapshot.docs.find(d => d.id === id)?.data() ?? null,
                ref: { id, update: vi.fn(), delete: vi.fn() }
            })
        })),
        add: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
        get: vi.fn().mockResolvedValue(snapshot)
    };
    return q;
}

// ── App factory ───────────────────────────────────────────────────────────────

function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api', apiRoutes);
    app.use(errorHandler);
    return app;
}

// ── Global setup ──────────────────────────────────────────────────────────────

let request;
// Exposed so tests can assert on which constraints reached Firestore. The mock
// ignores filters when producing results, so *what* was queried is the only
// observable difference between filtering in the query and filtering in memory.
let ratesQuery;
// The shared Firestore stub, kept so a test that swaps in its own store can put
// this one back afterwards.
let firestore;

beforeAll(() => {
    const ratesSnap = makeSnapshot(TEST_RATES);
    const optionsSnap = makeSnapshot(TEST_OPTIONS);
    const emptySnap = makeSnapshot([]);

    ratesQuery = makeChainableQuery(ratesSnap);
    const optionsQuery = makeChainableQuery(optionsSnap);

    firestore = {
        collection: vi.fn(name => {
            if (name === 'rates') return ratesQuery;
            if (name === 'options') return optionsQuery;
            return makeChainableQuery(emptySnap);
        }),
        batch: vi.fn(() => ({
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined)
        }))
    };

    vi.mocked(getFirestore).mockReturnValue(firestore);

    // RTDB mock for cache — always returns a cache miss
    const mockRtdbRef = {
        get: vi.fn().mockResolvedValue({ exists: () => false, child: () => ({ val: () => null }), val: () => null, forEach: () => {} }),
        once: vi.fn().mockResolvedValue({ val: () => null, exists: () => false }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        orderByChild: vi.fn(function() { return this; }),
        endAt: vi.fn(function() { return this; }),
    };
    vi.mocked(getDatabase).mockReturnValue({ ref: vi.fn(() => mockRtdbRef) });

    request = supertest(createApp());
});

// =============================================================================
// API v0  (/api)
// =============================================================================

describe('API v0 (/api)', () => {

    it('responds with an array of rates containing required fields', async () => {
        const res = await request.get('/api');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);

        for (const item of res.body) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('last_checked');
            expect(item).toHaveProperty('last_updated');
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('rate');
            expect(item).toHaveProperty('url');
            // Field types
            expect(typeof item.currency).toBe('string');
            expect(typeof item.rate).toBe('number');
            expect(typeof item.last_checked).toBe('number');
            expect(typeof item.last_updated).toBe('number');
        }

        // Spot-check that our test data is represented
        const currencies = res.body.map(r => r.currency);
        expect(currencies).toContain('ZWG');
        expect(currencies).toContain('ZAR');
    });

    const AGGREGATES = ['MIN', 'MAX', 'MEAN', 'MEDIAN', 'MODE', 'RANDOM'];

    it.each(AGGREGATES)('prefer=%s returns one rate per currency with required fields', async (prefer) => {
        const res = await request.get(`/api?prefer=${prefer}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        for (const item of res.body) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('last_checked');
            expect(item).toHaveProperty('last_updated');
            expect(item).toHaveProperty('rate');
            expect(typeof item.rate).toBe('number');
        }

        // One result per unique currency
        const currencies = res.body.map(r => r.currency);
        const unique = new Set(currencies);
        expect(currencies.length).toBe(unique.size);

        if (prefer !== 'RANDOM') {
            // Deterministic aggregates — verify known currencies appear
            expect(currencies).toContain('ZWG');
            expect(currencies).toContain('ZAR');
        }
    });

    it('filters by currency', async () => {
        const res = await request.get('/api?currency=ZWG');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);

        // Verify structure and that the requested currency is present
        for (const item of res.body) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('url');
            expect(item).toHaveProperty('rate');
        }
        const currencies = res.body.map(r => r.currency);
        expect(currencies).toContain('ZWG');
    });

    it('filters by date (unix timestamp)', async () => {
        // Use a timestamp from two days ago — every test rate is newer than that
        const twoDaysAgo = DateTime.now().minus({ days: 2 }).toUnixInteger();
        const res = await request.get(`/api?date=${twoDaysAgo}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        for (const item of res.body) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('last_checked');
            expect(item).toHaveProperty('last_updated');
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('rate');
            expect(item).toHaveProperty('url');
        }
    });

    it('rejects a currency it does not serve', async () => {
        const res = await request.get('/api?currency=JPY');
        expect(res.status).toBe(422);
        expect(res.body.status).toBe(false);
    });

    it('returns CORS header', async () => {
        const res = await request.get('/api');
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('rejects a future date', async () => {
        const future = DateTime.now().plus({ days: 1 }).toUnixInteger();
        const res = await request.get(`/api?date=${future}`);
        expect(res.status).toBe(400);
    });
});

// =============================================================================
// API v1  (/api/v1)
// =============================================================================

describe('API v1 (/api/v1)', () => {

    it('responds with USD wrapper containing required rate fields', async () => {
        const res = await request.get('/api/v1');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('USD');
        expect(Array.isArray(res.body.USD)).toBe(true);
        expect(res.body.USD.length).toBeGreaterThan(0);

        for (const item of res.body.USD) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('last_checked');
            expect(item).toHaveProperty('last_updated');
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('rate');
            expect(item).toHaveProperty('url');
        }

        const currencies = res.body.USD.map(r => r.currency);
        expect(currencies).toContain('ZWG');
        expect(currencies).toContain('ZAR');
    });

    it('includes info string by default', async () => {
        const res = await request.get('/api/v1');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('info');
        expect(typeof res.body.info).toBe('string');
        expect(res.body.info.length).toBeGreaterThan(0);
    });

    it('excludes info when info=false', async () => {
        const res = await request.get('/api/v1?info=false');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('info');
        expect(res.body).toHaveProperty('USD');
    });

    const AGGREGATES = ['MIN', 'MAX', 'MEAN', 'MEDIAN', 'MODE', 'RANDOM'];

    it.each(AGGREGATES)('prefer=%s returns one rate per currency under USD key', async (prefer) => {
        const res = await request.get(`/api/v1?prefer=${prefer}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('USD');
        expect(Array.isArray(res.body.USD)).toBe(true);

        for (const item of res.body.USD) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('last_checked');
            expect(item).toHaveProperty('last_updated');
            expect(item).toHaveProperty('rate');
        }

        const currencies = res.body.USD.map(r => r.currency);
        const unique = new Set(currencies);
        expect(currencies.length).toBe(unique.size);
    });

    it('filters by currency', async () => {
        const res = await request.get('/api/v1?currency=ZAR');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.USD)).toBe(true);
        expect(res.body.USD.length).toBeGreaterThan(0);

        for (const item of res.body.USD) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('url');
            expect(item).toHaveProperty('rate');
        }
        const currencies = res.body.USD.map(r => r.currency);
        expect(currencies).toContain('ZAR');
    });

    it('rejects a currency it does not serve', async () => {
        const res = await request.get('/api/v1?currency=JPY');
        expect(res.status).toBe(422);
        expect(res.body.status).toBe(false);
        expect(res.body.message).toMatch(/currency/i);
    });

    it('filters by date (unix timestamp)', async () => {
        const twoDaysAgo = DateTime.now().minus({ days: 2 }).toUnixInteger();
        const res = await request.get(`/api/v1?date=${twoDaysAgo}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('USD');
        expect(Array.isArray(res.body.USD)).toBe(true);
    });

    it('returns JSONP when callback param is provided', async () => {
        const res = await request.get('/api/v1?callback=myCallback');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/javascript/);
        expect(res.text).toMatch(/^myCallback\(/);
    });

    it('returns CORS header', async () => {
        const res = await request.get('/api/v1');
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('accepts POST with form-encoded body (WordPress plugin compat)', async () => {
        const res = await request.post('/api/v1')
            .type('form')
            .send({ prefer: 'mean' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('USD');
        expect(Array.isArray(res.body.USD)).toBe(true);
    });

    it('rejects invalid prefer value sent via POST', async () => {
        const res = await request.post('/api/v1')
            .type('form')
            .send({ prefer: 'invalid' });
        expect(res.status).toBe(400);
    });
});

// =============================================================================
// GraphQL  (/api/graphql)
// =============================================================================

describe('GraphQL (/api/graphql)', () => {

    const GQL = (query, variables = {}) =>
        request.post('/api/graphql').send({ query, variables });

    it('responds with rate data aliased as USD', async () => {
        const res = await GQL('query { USD: rate { currency last_checked last_updated name rate last_rate url } }');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data.USD)).toBe(true);

        for (const item of res.body.data.USD) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('last_checked');
            expect(item).toHaveProperty('last_updated');
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('rate');
            expect(item).toHaveProperty('url');
            expect(typeof item.currency).toBe('string');
            expect(typeof item.rate).toBe('number');
            expect(typeof item.last_rate).toBe('number');
            expect(typeof item.last_checked).toBe('number');
            expect(typeof item.last_updated).toBe('number');
        }

        const currencies = res.body.data.USD.map(r => r.currency);
        expect(currencies).toContain('ZWG');
        expect(currencies).toContain('ZAR');
    });

const AGGREGATES = ['MIN', 'MAX', 'MEAN', 'MEDIAN', 'MODE', 'RANDOM'];

    it.each(AGGREGATES)('prefer=%s returns one rate per currency', async (prefer) => {
        const res = await GQL(
            'query($prefer: Prefer!) { USD: rate(prefer: $prefer) { currency last_checked last_updated rate } }',
            { prefer }
        );
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');
        expect(Array.isArray(res.body.data.USD)).toBe(true);

        for (const item of res.body.data.USD) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('rate');
            expect(typeof item.rate).toBe('number');
        }

        const currencies = res.body.data.USD.map(r => r.currency);
        const unique = new Set(currencies);
        expect(currencies.length).toBe(unique.size);

        if (prefer !== 'RANDOM') {
            expect(currencies).toContain('ZWG');
            expect(currencies).toContain('ZAR');
        }
    });

    it('filters by currency using Currency enum', async () => {
        const res = await GQL(
            'query($currency: Currency) { USD: rate(currency: $currency) { currency last_checked last_updated name rate url } }',
            { currency: 'ZWG' }
        );
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');
        expect(Array.isArray(res.body.data.USD)).toBe(true);
        expect(res.body.data.USD.length).toBeGreaterThan(0);

        // Verify structure and the requested currency is represented
        for (const item of res.body.data.USD) {
            expect(item).toHaveProperty('currency');
            expect(item).toHaveProperty('rate');
        }
        const currencies = res.body.data.USD.map(r => r.currency);
        expect(currencies).toContain('ZWG');
    });

    it('filters by date', async () => {
        const twoDaysAgo = DateTime.now().minus({ days: 2 }).toUnixInteger();
        const res = await GQL(
            'query($date: Int!) { USD: rate(date: $date) { currency last_checked last_updated name rate url } }',
            { date: twoDaysAgo }
        );
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');
        expect(Array.isArray(res.body.data.USD)).toBe(true);
    });

    it('leaves results in USD when base is omitted', async () => {
        // The regression guard for existing clients: adding the argument must not
        // change what a query that does not use it returns.
        const res = await GQL('query { USD: rate(currency: ZAR) { currency rate } }');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.USD.find(r => r.currency === 'ZAR').rate).toBe(18.5);
    });

    it('expresses rates against the base currency when base is given', async () => {
        const res = await GQL(
            'query($base: Base) { rates: rate(base: $base) { currency name rate last_rate } }',
            { base: 'ZAR' }
        );
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');

        const byName = Object.fromEntries(res.body.data.rates.map(r => [r.name, r.rate]));
        expect(byName['RBZ - ZWG']).toBeCloseTo(26.5 / 18.5, 6);
        expect(byName['Black Market - ZWG']).toBeCloseTo(28.0 / 18.5, 6);

        // The base currency is meaningless expressed against itself.
        expect(res.body.data.rates.some(r => r.currency === 'ZAR')).toBe(false);
    });

    it('accepts USD as a base and returns stored rates unchanged', async () => {
        // USD is in the Base enum but not in Currency: no rate is stored for it.
        const res = await GQL('query { rates: rate(base: USD, currency: ZAR) { currency rate } }');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.rates.find(r => r.currency === 'ZAR').rate).toBe(18.5);
    });

    it('combines base with currency and prefer', async () => {
        const res = await GQL('query { rates: rate(base: ZAR, currency: ZWG, prefer: MEAN) { currency rate } }');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.rates).toHaveLength(1);
        // MEAN of the two ZWG rates, then crossed through ZAR.
        expect(res.body.data.rates[0].rate).toBeCloseTo(((26.5 + 28.0) / 2) / 18.5, 6);
    });

    it('errors for a base currency with no rates', async () => {
        // JPY is not in the fixture, so the Base enum rejects it before the
        // resolver runs — the same class of answer REST v2 gives with a 404.
        const res = await GQL('query { rates: rate(base: JPY) { currency rate } }');
        expect(res.status).toBe(200);
        expect(res.body.errors).toBeDefined();
    });

    it('returns info string from the info query', async () => {
        const res = await GQL('query { USD: rate { currency rate url }, info: info }');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data).toHaveProperty('info');
        expect(typeof res.body.data.info).toBe('string');
        expect(res.body.data.info.length).toBeGreaterThan(0);
    });

    it('returns CORS header', async () => {
        const res = await GQL('query { USD: rate { currency rate } }');
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe('*');
    });
});

// =============================================================================
// Request validation
// =============================================================================

describe('date validation', () => {

    afterEach(() => {
        vi.useRealTimers();
    });

    it('judges the date against the time of the request, not the time of module load', () => {
        // The schema was built when this file was imported. Age the clock past that
        // point the way a warm function instance does, then send a timestamp that is
        // in the past *now* — a ceiling frozen at module load would reject it.
        const loadedAt = DateTime.now();
        vi.useFakeTimers();
        vi.setSystemTime(loadedAt.plus({ hours: 2 }).toJSDate());

        const { error } = rateQuerySchema.validate({ date: loadedAt.plus({ hours: 1 }).toUnixInteger() });
        expect(error).toBeUndefined();
    });

    it('still rejects a timestamp in the future', () => {
        const { error } = rateQuerySchema.validate({ date: DateTime.now().plus({ days: 1 }).toUnixInteger() });
        expect(error).toBeDefined();
    });
});

// =============================================================================
// Rate.toAPI() — the non-null half of the GraphQL contract
// =============================================================================

describe('Rate.toAPI()', () => {

    it('returns numbers, never null, for a record missing its timestamps and last_rate', () => {
        const created = new Date('2026-01-01T00:00:00Z');
        const api = new Rate({
            rate_currency: 'ZWG',
            rate_name: 'RBZ - ZWG',
            source_url: 'https://rbz.co.zw',
            rate: 26.5,
            created_at: created
        }).toAPI();

        const createdUnix = DateTime.fromJSDate(created).toUnixInteger();
        expect(api.last_checked).toBe(createdUnix);
        expect(api.last_updated).toBe(createdUnix);
        expect(api.last_rate).toBe(26.5);
    });

    it('returns numbers, never NaN, for a record carrying an Invalid Date', () => {
        const api = new Rate({
            rate_currency: 'ZWG',
            rate: 26.5,
            updated_at: new Date('not a date'),
            rate_updated_at: new Date('not a date')
        }).toAPI();

        expect(api.last_checked).toBe(0);
        expect(api.last_updated).toBe(0);
    });
});

// =============================================================================
// Rate.upsertFromScrape() — last_rate is the previous *different* reading
// =============================================================================

describe('Rate.upsertFromScrape()', () => {

    const SOURCE = { id: 'source1', name: 'RBZ', url: 'https://rbz.co.zw' };
    const STORED = { rate_currency: 'ZWG', rate_name: 'RBZ - ZWG', rate: 26.5, last_rate: 24.0 };

    /**
     * Points getFirestore() at a store holding the one rate above, and returns the
     * updates the scrape batched. Every query resolves to that single document, which
     * is what upsertFromScrape's "find existing" lookup and its stale-record sweep
     * both read.
     */
    function captureScrape() {
        const updates = [];
        const doc = { id: 'rate1', exists: true, data: () => ({ ...STORED }), ref: { id: 'rate1' } };
        const query = makeChainableQuery({ docs: [doc], empty: false });

        vi.mocked(getFirestore).mockReturnValue({
            collection: vi.fn(() => query),
            batch: vi.fn(() => ({
                set: vi.fn(),
                update: vi.fn((_ref, data) => updates.push(data)),
                delete: vi.fn(),
                commit: vi.fn().mockResolvedValue(undefined)
            }))
        });

        return updates;
    }

    afterEach(() => {
        vi.mocked(getFirestore).mockReturnValue(firestore);
    });

    it('leaves last_rate untouched when the scraped value has not moved', async () => {
        const updates = captureScrape();

        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 26.5 }]);

        expect(updates).toHaveLength(1);
        expect(updates[0].rate).toBe(26.5);
        expect(updates[0]).not.toHaveProperty('last_rate');
    });

    it('shifts the stored rate into last_rate when the value moves', async () => {
        const updates = captureScrape();

        await Rate.upsertFromScrape(SOURCE, [{ currency: 'ZWG', rate: 27.25 }]);

        expect(updates).toHaveLength(1);
        expect(updates[0].rate).toBe(27.25);
        expect(updates[0].last_rate).toBe(26.5);
    });
});

// =============================================================================
// Contact form  (/api/contact)
// =============================================================================

describe('Contact form', () => {
    const VALID = {
        name: 'Jane Tester',
        email: 'jane@example.com',
        subject: 'API question',
        message: 'I have a question about the rates endpoint.'
    };

    it('reports disabled when no SMTP settings are stored', async () => {
        const res = await request.get('/api/contact');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ enabled: false });
    });

    it('rejects a submission with a missing field', async () => {
        const res = await request.post('/api/contact').send({ ...VALID, email: undefined });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('rejects a submission with an invalid email', async () => {
        const res = await request.post('/api/contact').send({ ...VALID, email: 'not-an-email' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('rejects a message that is too short', async () => {
        const res = await request.post('/api/contact').send({ ...VALID, message: 'hi' });
        expect(res.status).toBe(400);
    });

    it('silently accepts and discards honeypot submissions', async () => {
        const res = await request
            .post('/api/contact')
            .send({ ...VALID, website: 'http://spam.example' });
        // Returns success so bots get no signal, but nothing is sent.
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
    });

    it('returns 503 when the form is not enabled', async () => {
        const res = await request.post('/api/contact').send(VALID);
        expect(res.status).toBe(503);
        expect(res.body).toHaveProperty('error');
    });
});

// =============================================================================
// Admin SMTP settings  (/api/admin/smtp)
// =============================================================================

describe('Admin SMTP settings', () => {
    it('requires authentication to read settings', async () => {
        const res = await request.get('/api/admin/smtp');
        expect(res.status).toBe(401);
    });

    it('requires authentication to update settings', async () => {
        const res = await request.put('/api/admin/smtp').send({ host: 'smtp.example.com' });
        expect(res.status).toBe(401);
    });

    it('requires authentication to test the connection', async () => {
        const res = await request.post('/api/admin/smtp/test').send({});
        expect(res.status).toBe(401);
    });
});

// =============================================================================
// Branding  (/api/branding, /api/admin/branding)
// =============================================================================

describe('Branding', () => {
    it('serves public branding with defaults when nothing is stored', async () => {
        const res = await request.get('/api/branding');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('app_name');
        expect(res.body).toHaveProperty('icon_url');
        expect(res.body).toHaveProperty('og_image_url');
    });

    it('returns asset URLs on a fixed path so they stay stable', async () => {
        const res = await request.get('/api/branding');
        // The path must not change between uploads — the og:image meta tag in
        // index.html points at it statically.
        expect(res.body.icon_url).toContain('/o/branding%2Fapp-icon.png');
        expect(res.body.og_image_url).toContain('/o/branding%2Fog-image.png');
    });

    it('serves assets from Firebase Storage URLs so storage.rules applies', async () => {
        const res = await request.get('/api/branding');
        // storage.googleapis.com is gated by bucket IAM, not the rules, and 403s.
        expect(res.body.og_image_url).toMatch(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//);
        expect(res.body.og_image_url).toContain('alt=media');
    });

    it('carries no version query, so the URL is identical across uploads', async () => {
        const res = await request.get('/api/branding');
        expect(res.body.icon_url).toMatch(/\?alt=media$/);
        expect(res.body.og_image_url).toMatch(/\?alt=media$/);
    });

    it('exposes repo_url publicly so the fork ribbon and footer link can render', async () => {
        const res = await request.get('/api/branding');
        // The client holds no fallback for this — a missing field hides both
        // the ribbon and the footer GitHub link rather than showing a stale URL.
        expect(res.body).toHaveProperty('repo_url');
        expect(res.body.repo_url).toMatch(/^https?:\/\//);
    });

    it('requires authentication to read admin branding', async () => {
        const res = await request.get('/api/admin/branding');
        expect(res.status).toBe(401);
    });

    it('requires authentication to update branding', async () => {
        const res = await request.put('/api/admin/branding').send({ app_name: 'Nope' });
        expect(res.status).toBe(401);
    });
});

// =============================================================================
// Self-service account deletion  (DELETE /api/account)
// =============================================================================

describe('Account deletion', () => {
    it('refuses a caller with no ID token', async () => {
        // The uid deleted is the token's own, so an unverified caller must never
        // reach the handler — this is the whole authorisation check.
        const res = await request.delete('/api/account');
        expect(res.status).toBe(401);
    });

    it('is not exposed on any other method', async () => {
        expect((await request.get('/api/account')).status).toBe(404);
        expect((await request.post('/api/account')).status).toBe(404);
    });
});

// =============================================================================
// Account registration gate  (registration_enabled)
// =============================================================================

describe('Account registration gate', () => {
    it('still requires admin auth to create a user', async () => {
        const res = await request
            .post('/api/admin/users')
            .send({ email: 'new@example.com', password: 'secret123' });
        // The gate sits behind auth — an anonymous caller never reaches it.
        expect(res.status).toBe(401);
    });

    it('no longer exposes a rates list endpoint', async () => {
        // Removed deliberately: the admin SPA reads rates from Firestore so it
        // can use cursor pagination. Unauthenticated callers get the auth
        // failure from the admin router, not a route handler.
        const res = await request.get('/api/admin/rates');
        expect(res.status).toBe(401);
    });
});

// =============================================================================
// The registration gate itself, with an authenticated admin
// =============================================================================

describe('registration_enabled enforcement', () => {
    /** Stands in the whole Firestore mock for one call, then restores it. */
    async function withRegistrationOption(value, fn) {
        const original = vi.mocked(getFirestore).getMockImplementation();
        const optionDocs = makeSnapshot([
            { id: 'reg', key: 'registration_enabled', value }
        ]);
        vi.mocked(getFirestore).mockReturnValue({
            collection: vi.fn(() => makeChainableQuery(optionDocs)),
            batch: vi.fn(() => ({ commit: vi.fn().mockResolvedValue(undefined) }))
        });
        try {
            return await fn();
        } finally {
            if (original) vi.mocked(getFirestore).mockImplementation(original);
        }
    }

    /** An authenticated admin caller. */
    function asAdmin() {
        vi.mocked(getAuth).mockReturnValue({
            verifyIdToken: vi.fn().mockResolvedValue({ uid: 'admin1', admin: true }),
            createUser: vi.fn().mockResolvedValue({
                uid: 'new1', email: 'new@example.com', displayName: null
            })
        });
    }

    it('refuses to create a user when registration is disabled', async () => {
        asAdmin();
        const res = await withRegistrationOption('false', () =>
            request
                .post('/api/admin/users')
                .set('Authorization', 'Bearer test-token')
                .send({ email: 'new@example.com', password: 'secret123' })
        );

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/registration is disabled/i);
    });

    it('allows creation when registration is enabled', async () => {
        asAdmin();
        const res = await withRegistrationOption('true', () =>
            request
                .post('/api/admin/users')
                .set('Authorization', 'Bearer test-token')
                .send({ email: 'new@example.com', password: 'secret123' })
        );

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('uid');
    });
});

describe('Branding contact fields', () => {
    it('exposes author contact details publicly', async () => {
        const res = await request.get('/api/branding');
        expect(res.status).toBe(200);
        // The footer, FAQ and privacy pages read these; they used to be
        // hardcoded in four separate files.
        expect(res.body).toHaveProperty('author_name');
        expect(res.body).toHaveProperty('author_email');
        expect(res.body).toHaveProperty('author_url');
    });
});

// =============================================================================
// Analytics middleware  (GA4 Measurement Protocol)
// =============================================================================

describe('Analytics middleware', () => {
    const IP = '203.0.113.9';
    const UA = 'curl/8.4.0';

    // The salt is read once at module load, so each case needs a fresh copy.
    async function load(env) {
        vi.resetModules();
        Object.entries(env).forEach(([k, v]) => vi.stubEnv(k, v));
        return (await import('../middleware/analytics.js')).logAnalytics;
    }

    // req.path is mount-relative inside the middleware: the app mounts the API
    // router at '/api', so a call to /api/v1 arrives here as '/v1'.
    const fakeReq = (ip = IP, path = '/v1') => ({
        ip,
        method: 'GET',
        headers: { 'user-agent': UA },
        path,
        acceptsLanguages: () => ['en'],
    });

    /** Runs the middleware and returns whatever it tried to POST to GA4. */
    function capture(logAnalytics, req) {
        const sent = [];
        const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
            sent.push(JSON.parse(init.body));
            return Promise.resolve({ ok: true });
        });
        const next = vi.fn();
        logAnalytics(req, {}, next);
        expect(next).toHaveBeenCalledOnce();
        spy.mockRestore();
        return sent;
    }

    const CONFIGURED = {
        MEASUREMENT_ID: 'G-TEST123456',
        MEASUREMENT_PROTOCOL_API_SECRET: 'test-secret',
        ANALYTICS_SALT: 'fixed-test-salt',
    };

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('never sends the caller IP to Google', async () => {
        const mw = await load(CONFIGURED);
        const [body] = capture(mw, fakeReq());
        // Google's Measurement Protocol policy forbids uploading PII, and an IP
        // is personal data under GDPR.
        expect(JSON.stringify(body)).not.toContain(IP);
    });

    it('does not report anonymous callers as identified users', async () => {
        const mw = await load(CONFIGURED);
        const [body] = capture(mw, fakeReq());
        // user_id means a known, signed-in person; this API has no accounts.
        expect(body.user_id).toBeUndefined();
    });

    it('derives a client_id that is stable per caller and differs across callers', async () => {
        const mw = await load(CONFIGURED);
        const [first] = capture(mw, fakeReq());
        const [again] = capture(mw, fakeReq());
        const [other] = capture(mw, fakeReq('198.51.100.4'));

        expect(first.client_id).toMatch(/^[0-9a-f]{32}$/);
        expect(again.client_id).toBe(first.client_id);
        expect(other.client_id).not.toBe(first.client_id);
    });

    it('tags every event with a session so GA4 keeps them in session reports', async () => {
        const mw = await load(CONFIGURED);
        const [body] = capture(mw, fakeReq());
        expect(body.events.length).toBeGreaterThan(0);
        for (const event of body.events) {
            expect(event.params.session_id).toBeTruthy();
        }
    });

    it('reports an API call as an event, never as a page view', async () => {
        const mw = await load(CONFIGURED);
        const [body] = capture(mw, fakeReq());
        // A page_view would drop REST endpoints into the Pages reports and
        // inflate pageview counts alongside real site pages.
        expect(body.events.map((e) => e.name)).toEqual(['api_request']);
        expect(body.events[0].params.endpoint).toBe('/api/v1');
        expect(body.events[0].params.method).toBe('GET');
    });

    it('collapses document ids so the endpoint dimension stays bounded', async () => {
        const mw = await load(CONFIGURED);
        const endpoint = (path) => capture(mw, fakeReq(IP, path))[0].events[0].params.endpoint;

        // Two different documents must land on one dimension value, or GA4
        // buckets everything into "(other)" past 500 distinct values a day.
        expect(endpoint('/admin/users/x7Kd2aQ')).toBe('/api/admin/users/{id}');
        expect(endpoint('/admin/users/zzz999')).toBe('/api/admin/users/{id}');
        expect(endpoint('/admin/users/x7Kd2aQ/claims')).toBe('/api/admin/users/{id}/claims');
        // Scanner traffic collapses too, rather than each probe earning a row.
        expect(endpoint('/wp-login.php')).toBe('/api/{id}');
        expect(endpoint('/')).toBe('/api');
    });

    it('stays a no-op when analytics is not configured', async () => {
        const mw = await load({ MEASUREMENT_ID: '', MEASUREMENT_PROTOCOL_API_SECRET: '' });
        expect(capture(mw, fakeReq())).toHaveLength(0);
    });
});

// =============================================================================
// API v2  (/api/v2 — arbitrary base currency via cross-rates)
// =============================================================================

describe('API v2', () => {
    // Fixture: ZWG 26.5 and 28.0, ZAR 18.5 — all per 1 USD.
    const ZAR_PER_USD = 18.5;

    it('returns the { base, rates, info } envelope', async () => {
        const res = await request.get('/api/v2/USD');
        expect(res.status).toBe(200);
        expect(res.body.base).toBe('USD');
        expect(Array.isArray(res.body.rates)).toBe(true);
        expect(res.body.info).toBe(TEST_INFO);
    });

    it('returns stored rates unchanged when the base is USD', async () => {
        const res = await request.get('/api/v2/USD');
        const zar = res.body.rates.find(r => r.currency === 'ZAR');
        // USD is the native base, so no conversion should happen.
        expect(zar.rate).toBe(ZAR_PER_USD);
    });

    it('cross-multiplies through the base currency and excludes the base itself', async () => {
        const res = await request.get('/api/v2/ZAR');
        expect(res.status).toBe(200);

        // Two ZWG rates exist (RBZ 26.5, Black Market 28.0), so assert by name
        // rather than by position — results are ordered by updated_at desc.
        const byName = Object.fromEntries(res.body.rates.map(r => [r.name, r.rate]));
        expect(byName['RBZ - ZWG']).toBeCloseTo(26.5 / ZAR_PER_USD, 6);
        expect(byName['Black Market - ZWG']).toBeCloseTo(28.0 / ZAR_PER_USD, 6);

        // The base currency is meaningless expressed against itself.
        expect(res.body.rates.some(r => r.currency === 'ZAR')).toBe(false);
    });

    it('never sends the currency filter to Firestore', async () => {
        // This is the actual regression guard. The query mock returns the full
        // dataset regardless of filters, so a currency filter pushed back into
        // the Firestore query would still produce a correct-looking response
        // here while 404ing against real Firestore — the base currency's rates
        // would be gone and the divisor with them. Asserting on the constraints
        // that were issued is the only way to catch it in this harness.
        ratesQuery.where.mockClear();
        const res = await request.get('/api/v2/ZAR?currency=ZWG');
        expect(res.status).toBe(200);

        const fields = ratesQuery.where.mock.calls.map(c => c[0]);
        expect(fields).toContain('enabled');
        expect(fields).not.toContain('rate_currency');
    });

    it('filters by currency without starving the cross-rate divisor', async () => {
        const res = await request.get('/api/v2/ZAR?currency=ZWG');
        expect(res.status).toBe(200);
        expect(res.body.rates.length).toBeGreaterThan(0);
        expect(res.body.rates.every(r => r.currency === 'ZWG')).toBe(true);
        const byName = Object.fromEntries(res.body.rates.map(r => [r.name, r.rate]));
        expect(byName['RBZ - ZWG']).toBeCloseTo(26.5 / ZAR_PER_USD, 6);
    });

    it('applies the currency filter on the USD short-circuit too', async () => {
        // base=USD returns early, so it needs the filters applied separately.
        const res = await request.get('/api/v2/USD?currency=ZAR');
        expect(res.status).toBe(200);
        expect(res.body.rates.every(r => r.currency === 'ZAR')).toBe(true);
    });

    it('narrows by rate name via search', async () => {
        const res = await request.get('/api/v2/USD?search=black');
        expect(res.status).toBe(200);
        expect(res.body.rates.length).toBeGreaterThan(0);
        expect(res.body.rates.every(r => /black/i.test(r.name))).toBe(true);
    });

    it('rejects search and name together', async () => {
        const res = await request.get('/api/v2/USD?search=rbz&name=rbz');
        expect(res.status).toBe(400);
    });

    it('excludes rates older than the date parameter', async () => {
        // Every fixture last moved hours ago, so a cutoff of a minute ago clears them.
        const justNow = DateTime.now().minus({ minutes: 1 }).toUnixInteger();
        const res = await request.get(`/api/v2/USD?date=${justNow}`);
        expect(res.status).toBe(200);
        expect(res.body.rates).toHaveLength(0);
    });

    it('treats the base path segment as case insensitive', async () => {
        // It is a url, so lowercase must work; Joi uppercases before matching.
        const lower = await request.get('/api/v2/zar');
        const upper = await request.get('/api/v2/ZAR');
        expect(lower.status).toBe(200);
        expect(lower.body.base).toBe('ZAR');
        expect(lower.body.rates).toEqual(upper.body.rates);
    });

    it('rejects the bare /v2 form with guidance towards the path', async () => {
        const res = await request.get('/api/v2');
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('/api/v2/ZAR');
    });

    it('no longer accepts base as a query parameter', async () => {
        // base moved into the path; the old query form must fail loudly rather
        // than silently returning USD-based rates.
        const res = await request.get('/api/v2?base=ZAR');
        expect(res.status).toBe(400);
    });

    it('404s for a base currency with no rates', async () => {
        const res = await request.get('/api/v2/JPY');
        expect(res.status).toBe(404);
    });

    it('serves JSONP when a callback is given', async () => {
        const res = await request.get('/api/v2/USD?callback=myFunction');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/javascript');
        expect(res.text).toMatch(/^myFunction\(/);
    });

    it('omits the notice when info=false', async () => {
        const res = await request.get('/api/v2/USD?info=false');
        expect(res.status).toBe(200);
        expect(res.body.info).toBeUndefined();
    });
});

// =============================================================================
// Coin economy  (/api/admin/economy, /api/admin/app-users)
// =============================================================================

describe('Economy endpoints', () => {
    /** An authenticated admin, plus whatever auth surface the test under it needs. */
    function asAdmin(extra = {}) {
        vi.mocked(getAuth).mockReturnValue({
            verifyIdToken: vi.fn().mockResolvedValue({ uid: 'admin1', admin: true }),
            ...extra
        });
    }

    /** Stands a tree of `path -> value` in for the whole database mock, then restores it. */
    async function withDatabase(tree, fn) {
        const original = vi.mocked(getDatabase).getMockImplementation();
        vi.mocked(getDatabase).mockReturnValue({
            ref: vi.fn(path => ({
                get: vi.fn(async () => ({
                    exists: () => tree[path] !== undefined,
                    val: () => tree[path],
                    forEach: (cb) => Object.entries(tree[path] ?? {})
                        .forEach(([key, value]) => cb({ key, val: () => value })),
                })),
            }))
        });
        try {
            return await fn();
        } finally {
            if (original) vi.mocked(getDatabase).mockImplementation(original);
        }
    }

    afterEach(() => {
        vi.mocked(getAuth).mockReturnValue({ verifyIdToken: vi.fn() });
    });

    it('requires admin auth', async () => {
        expect((await request.get('/api/admin/economy')).status).toBe(401);
        expect((await request.get('/api/admin/app-users')).status).toBe(401);
    });

    it('reports no snapshot rather than an error before the first sweep', async () => {
        asAdmin();
        const res = await request
            .get('/api/admin/economy')
            .set('Authorization', 'Bearer test-token');

        // Nothing is wrong on a fresh project — the sweep simply has not run yet.
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ computedAt: null });
    });

    it('returns the nightly snapshot as written', async () => {
        asAdmin();
        const stats = {
            computedAt: 1_700_000_000,
            users: 3,
            coinsOutstanding: 42,
            usersOverdrawn: 1,
            accounts: { total: 3, anonymous: 2, linked: 1, newLast7d: 1 },
        };

        const res = await withDatabase({ 'stats/economy': stats }, () =>
            request.get('/api/admin/economy').set('Authorization', 'Bearer test-token')
        );

        expect(res.status).toBe(200);
        expect(res.body).toEqual(stats);
    });

    it('lists app users with their balance and whether they can sign back in', async () => {
        asAdmin({
            listUsers: vi.fn().mockResolvedValue({
                users: [
                    {
                        uid: 'anon1',
                        email: undefined,
                        displayName: null,
                        providerData: [],
                        disabled: false,
                        customClaims: {},
                        metadata: { creationTime: 'Tue, 01 Sep 2026 09:00:00 GMT' },
                    },
                    {
                        uid: 'linked1',
                        email: 'someone@example.com',
                        displayName: 'Someone',
                        providerData: [{ providerId: 'google.com' }],
                        disabled: false,
                        customClaims: {},
                        metadata: {
                            creationTime: 'Tue, 01 Sep 2026 09:00:00 GMT',
                            lastSignInTime: 'Wed, 02 Sep 2026 09:00:00 GMT',
                        },
                    },
                ],
                pageToken: 'next-page',
            })
        });

        const ahead = Math.floor(Date.now() / 1000) + 86_400;
        const res = await withDatabase({
            'users/linked1/rewards': { a: { balance: 5, expiresAt: ahead } },
        }, () => request.get('/api/admin/app-users').set('Authorization', 'Bearer test-token'));

        expect(res.status).toBe(200);
        expect(res.body.nextPageToken).toBe('next-page');
        expect(res.body.users).toHaveLength(2);
        expect(res.body.users[0]).toMatchObject({ uid: 'anon1', anonymous: true, balance: 0 });
        expect(res.body.users[1]).toMatchObject({ uid: 'linked1', anonymous: false, balance: 5 });
    });

    it('caps the page size so one call cannot pull the whole user base', async () => {
        const listUsers = vi.fn().mockResolvedValue({ users: [], pageToken: undefined });
        asAdmin({ listUsers });

        await request
            .get('/api/admin/app-users?limit=5000')
            .set('Authorization', 'Bearer test-token');

        expect(listUsers).toHaveBeenCalledWith(100, undefined);
    });

    it('404s a wallet for a uid that has no account', async () => {
        asAdmin({ getUser: vi.fn().mockRejectedValue(new Error('no such user')) });

        const res = await request
            .get('/api/admin/app-users/ghost/wallet')
            .set('Authorization', 'Bearer test-token');

        expect(res.status).toBe(404);
    });
});

// =============================================================================
// Console roster  (/api/admin/users)
// =============================================================================

describe('Console roster', () => {
    afterEach(() => {
        vi.mocked(getAuth).mockReturnValue({ verifyIdToken: vi.fn() });
    });

    it('leaves out anonymous accounts, and keeps looking past a page of them', async () => {
        const anonymous = (uid) => ({
            uid,
            providerData: [],
            metadata: { creationTime: 'Tue, 01 Sep 2026 09:00:00 GMT' },
        });

        // The admin sits on the second page. listUsers returns accounts in uid order, so
        // filtering in the browser over a truncated prefix would simply lose them.
        const listUsers = vi.fn()
            .mockResolvedValueOnce({
                users: [anonymous('a1'), anonymous('a2')],
                pageToken: 'page2',
            })
            .mockResolvedValueOnce({
                users: [{
                    uid: 'admin1',
                    email: 'admin@example.com',
                    providerData: [{ providerId: 'password' }],
                    customClaims: { admin: true },
                    metadata: { creationTime: 'Tue, 01 Sep 2026 09:00:00 GMT' },
                }],
                pageToken: undefined,
            });

        vi.mocked(getAuth).mockReturnValue({
            verifyIdToken: vi.fn().mockResolvedValue({ uid: 'admin1', admin: true }),
            listUsers,
        });

        const res = await request
            .get('/api/admin/users')
            .set('Authorization', 'Bearer test-token');

        expect(res.status).toBe(200);
        expect(res.body.map(u => u.uid)).toEqual(['admin1']);
        expect(listUsers).toHaveBeenCalledTimes(2);
    });
});
