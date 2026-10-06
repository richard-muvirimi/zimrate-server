/**
 * The deterministic half of source discovery: which search results become
 * candidates, and what a candidate must show to pass vetting. The search and
 * the dry-run scrape are stubbed; their real runs are checked by hand.
 */
import { vi, describe, it, expect, afterEach } from 'vitest';

vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));
vi.mock('../models/Option.js', () => ({
    default: { getValue: vi.fn(async (_key, fallback) => fallback) }
}));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(),
    FieldValue: { serverTimestamp: () => 'now' },
    Timestamp: class {},
}));

import { getFirestore } from 'firebase-admin/firestore';
import Option from '../models/Option.js';
import { cleanUrl, urlKey, isBlocked, DiscoveryService } from '../services/DiscoveryService.js';
import { ScrapingService } from '../services/ScrapingService.js';
import Rate from '../models/Rate.js';

describe('cleanUrl and urlKey', () => {

    const ZPC = 'https://zimpricecheck.com/price-updates/official-and-black-market-exchange-rates/';

    it('recognises the stored zimpricecheck source behind Google\'s tracking parameter', () => {
        expect(urlKey(`${ZPC}?srsltid=AfmBOoqJtXHg2sfV87UIJqxry9p3DS6S41iBnRbQ7bWYvxwh50iwdiWG`)).toBe(urlKey(ZPC));
    });

    it('ignores www, a trailing slash and the fragment', () => {
        expect(urlKey('https://www.cabs.co.zw/exchange-rates/#usd')).toBe(urlKey('https://cabs.co.zw/exchange-rates'));
    });

    it('keeps query parameters that pick out a different page', () => {
        expect(urlKey('https://bank.co.zw/rates?branch=1')).not.toBe(urlKey('https://bank.co.zw/rates?branch=2'));
        expect(cleanUrl('https://bank.co.zw/rates?branch=1&utm_source=x')).toBe('https://bank.co.zw/rates?branch=1');
    });

    it('refuses anything that is not a web page', () => {
        expect(cleanUrl('mailto:rates@bank.co.zw')).toBeNull();
        expect(cleanUrl('not a url')).toBeNull();
    });
});

describe('isBlocked', () => {

    it('blocks a domain and its subdomains, and nothing that merely ends alike', () => {
        const blocked = ['bybit.com'];
        expect(isBlocked('https://www.bybit.com/en/convert/zig-to-usd/', blocked)).toBe(true);
        expect(isBlocked('https://bybit.com/', blocked)).toBe(true);
        expect(isBlocked('https://notbybit.com/', blocked)).toBe(false);
    });
});

describe('DiscoveryService.discover', () => {

    const ZPC = 'https://zimpricecheck.com/price-updates/official-and-black-market-exchange-rates/';
    let created;

    const firestore = ({ sources = [], candidates = [] } = {}) => {
        created = [];
        const docsOf = (urls) => ({ docs: urls.map(url => ({ data: () => ({ url }) })) });
        vi.mocked(getFirestore).mockReturnValue({
            collection: (name) => ({
                select: () => ({ get: async () => docsOf(name === 'sources' ? sources : candidates) }),
                doc: (id) => ({ create: async (data) => created.push({ id, ...data }) }),
            }),
        });
    };

    const results = (...urls) => vi.spyOn(DiscoveryService, 'search')
        .mockResolvedValue(urls.map(url => ({ url, title: url, description: '', query: 'ZiG exchange rate today' })));

    afterEach(() => vi.restoreAllMocks());

    it('files only pages that are new, unblocked and not yet sources', async () => {
        firestore({ sources: [`${ZPC}?srsltid=abc`], candidates: ['https://rejected.co.zw/rates'] });
        results(
            'https://www.bybit.com/en/convert/zig-to-usd/',
            ZPC,
            'https://rejected.co.zw/rates/',
            'https://newbank.co.zw/forex?utm_source=google',
            'https://www.newbank.co.zw/forex/',
        );

        expect(await DiscoveryService.discover()).toEqual({ results: 5, added: 1 });
        expect(created).toEqual([expect.objectContaining({
            url: 'https://newbank.co.zw/forex',
            domain: 'newbank.co.zw',
            status: 'new',
        })]);
    });

    it('files no more than discovery_max_candidates per run', async () => {
        firestore();
        results(...Array.from({ length: 15 }, (_, i) => `https://bank${i}.co.zw/rates`));

        expect((await DiscoveryService.discover()).added).toBe(10);
    });

    it('refuses to run with no queries set', async () => {
        firestore();
        vi.mocked(Option.getValue).mockImplementation(async (key, fallback) => (key === 'discovery_queries' ? ' \n ' : fallback));

        await expect(DiscoveryService.discover()).rejects.toThrow('No discovery queries are set');
        vi.mocked(Option.getValue).mockImplementation(async (_key, fallback) => fallback);
    });
});

describe('DiscoveryService.vet', () => {

    const test = (rates) => vi.spyOn(ScrapingService, 'testSource').mockResolvedValue({
        ok: true,
        javascript: false,
        attempts: [{ javascript: false, rates, error: null }],
    });

    const dated = (rate) => ({ currency: 'ZWG', name: 'Official', page_date: '2026-10-06', updated_at: null, rate });

    const consensus = () => {
        vi.spyOn(Rate, 'consensus').mockResolvedValue({ ZWG: 29 });
        vi.spyOn(Rate, 'consensusTolerance').mockResolvedValue(2);
    };

    afterEach(() => vi.restoreAllMocks());

    it('passes a dated page whose rates agree with the trusted sources', async () => {
        test([dated(26.8)]);
        consensus();

        const verdict = await DiscoveryService.vet('https://bank.co.zw/rates');

        expect(verdict.status).toBe('passed');
        expect(verdict.page_date).toBe('2026-10-06');
        expect(verdict.rates).toEqual([{ currency: 'ZWG', name: 'Official', rate: 26.8, refused: false }]);
    });

    it('fails a page that shows no date', async () => {
        test([{ ...dated(26.8), page_date: null }]);
        consensus();

        const verdict = await DiscoveryService.vet('https://bank.co.zw/rates');

        expect(verdict.status).toBe('failed');
        expect(verdict.error).toMatch(/no date/);
    });

    it('fails a page none of whose rates agree with the trusted sources', async () => {
        // A ZIG token price read as ZiG.
        test([dated(0.0008)]);
        consensus();

        const verdict = await DiscoveryService.vet('https://crypto.example/zig');

        expect(verdict.status).toBe('failed');
        expect(verdict.rates[0].refused).toBe(true);
    });

    it('passes a page with some refused rates, and marks which', async () => {
        test([dated(26.8), { ...dated(405.88), name: 'RTGS' }]);
        consensus();

        const verdict = await DiscoveryService.vet('https://bank.co.zw/rates');

        expect(verdict.status).toBe('passed');
        expect(verdict.rates.map(r => r.refused)).toEqual([false, true]);
    });

    it('fails with the dry run\'s own errors when no rates were found', async () => {
        vi.spyOn(ScrapingService, 'testSource').mockResolvedValue({
            ok: false,
            javascript: null,
            attempts: [
                { javascript: false, rates: [], error: 'No currency rates were found on this page' },
                { javascript: true, rates: [], error: 'Apify returned no items for this URL' },
            ],
        });

        const verdict = await DiscoveryService.vet('https://bank.co.zw/rates');

        expect(verdict.status).toBe('failed');
        expect(verdict.error).toBe('No currency rates were found on this page | Apify returned no items for this URL');
    });
});
