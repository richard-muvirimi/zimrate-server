/**
 * The deterministic half of rate extraction — the rules that hold whatever the
 * model returns. The model's own output is checked by hand against the live API;
 * these are the guards that must not depend on it.
 */
import { vi, describe, it, expect, afterEach } from 'vitest';

vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

import { normaliseCurrency, tidyLabel, restorePrecision, ScrapingService } from '../services/ScrapingService.js';

describe('normaliseCurrency', () => {

    it('files ZiG under its ISO code', () => {
        // The source page calls the currency ZiG in every table and gives the ISO
        // code once, in a footnote. Both spellings must reach the same record, or
        // the currency is served twice with half its history each.
        expect(normaliseCurrency('ZIG')).toBe('ZWG');
    });

    it('leaves every other code alone', () => {
        expect(normaliseCurrency('ZWG')).toBe('ZWG');
        expect(normaliseCurrency('ZAR')).toBe('ZAR');
        expect(normaliseCurrency('USD')).toBe('USD');
    });
});

describe('tidyLabel', () => {

    it.each([
        ['1 USD to ZiG (Official)', 'Official'],
        ['1 USD to ZiG cash rate', 'cash rate'],
        ['1 USD to ZiG — lowest informal-sector rate', 'lowest informal-sector rate'],
    ])('drops the quoted pair from %s', (raw, expected) => {
        expect(tidyLabel(raw)).toBe(expected);
    });

    it.each(['OK Supermarket', 'Maximum rate businesses can use', 'ZAR'])(
        'leaves a label that is already just a label: %s',
        (raw) => expect(tidyLabel(raw)).toBe(raw),
    );

    it('keeps the original when stripping would leave nothing', () => {
        // Better a redundant name than an empty one.
        expect(tidyLabel('1 ZiG to USD')).toBe('1 ZiG to USD');
    });
});

describe('restorePrecision', () => {

    it('restores the value the converter computed when the model rounds it', () => {
        // What the live API was serving: a rate stored three decimals short of the
        // figure the tool handed the model, so every scrape looked like a move.
        expect(restorePrecision(17.585, [17.585089])).toBe(17.585089);
        expect(restorePrecision(2636.5, [2636.544554])).toBe(2636.5445540);
    });

    it('leaves a value the model read off the page untouched', () => {
        // 26.5 is not any computed value rounded — it is the page's own figure.
        expect(restorePrecision(26.5, [17.585089])).toBe(26.5);
        expect(restorePrecision(17.58, [17.585089])).toBe(17.58);
        // A whole number is not surrendered to a conversion it only rounds to.
        expect(restorePrecision(27, [26.5089])).toBe(27);
    });

    it('is a no-op when the model quoted the computed value in full', () => {
        expect(restorePrecision(17.585089, [17.585089])).toBe(17.585089);
    });

    it('leaves everything alone when no conversion was computed', () => {
        expect(restorePrecision(17.585, [])).toBe(17.585);
    });
});

describe('ScrapingService.testSource', () => {

    const PAGE = 'x'.repeat(100);
    const RATES = [{ currency: 'ZWG', rate: 26.5, name: 'Official', updated_at: null }];

    // Each case scripts the two fetch modes; the real Apify and LLM calls never run.
    const stub = ({ staticPage, browserPage, staticRates = [], browserRates = [] }) => {
        const fetchPage = vi.spyOn(ScrapingService, 'fetchPage')
            .mockImplementation(async (_url, javascript) => {
                const page = javascript ? browserPage : staticPage;
                if (page instanceof Error) throw page;
                return page;
            });
        vi.spyOn(ScrapingService, 'extractRates')
            .mockImplementation(async () =>
                fetchPage.mock.lastCall[1] ? browserRates : staticRates);
        return fetchPage;
    };

    afterEach(() => vi.restoreAllMocks());

    it('stops at the static fetch when it finds rates', async () => {
        const fetchPage = stub({ staticPage: PAGE, staticRates: RATES });

        const result = await ScrapingService.testSource('https://example.com');

        expect(result.ok).toBe(true);
        expect(result.javascript).toBe(false);
        expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it('falls back to the browser when the static page has no rates', async () => {
        stub({ staticPage: PAGE, browserPage: PAGE, browserRates: RATES });

        const result = await ScrapingService.testSource('https://example.com');

        expect(result.ok).toBe(true);
        expect(result.javascript).toBe(true);
        expect(result.attempts[0].error).toMatch(/No currency rates/);
        expect(result.attempts[1].rates).toEqual(RATES);
    });

    it('falls back to the browser when the static fetch is nearly empty or throws', async () => {
        stub({ staticPage: 'Loading…', browserPage: PAGE, browserRates: RATES });
        expect((await ScrapingService.testSource('https://example.com')).javascript).toBe(true);

        vi.restoreAllMocks();
        stub({ staticPage: new Error('Apify API error 500'), browserPage: PAGE, browserRates: RATES });
        expect((await ScrapingService.testSource('https://example.com')).javascript).toBe(true);
    });

    it('reports failure with both attempts when neither finds rates', async () => {
        stub({ staticPage: PAGE, browserPage: new Error('Apify returned no items for this URL') });

        const result = await ScrapingService.testSource('https://example.com');

        expect(result.ok).toBe(false);
        expect(result.javascript).toBeNull();
        expect(result.attempts.map(a => a.error)).toEqual([
            'No currency rates were found on this page',
            'Apify returned no items for this URL',
        ]);
        expect(result.attempts[0].preview).toBe(PAGE);
    });
});
