/**
 * The deterministic half of rate extraction — the rules that hold whatever the
 * model returns. The model's own output is checked by hand against the live API;
 * these are the guards that must not depend on it.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));
// Every setting reads as unset, so the built-in defaults apply.
vi.mock('../models/Option.js', () => ({
    default: { getValue: vi.fn(async (_key, fallback) => fallback) }
}));

import { DateTime } from 'luxon';
import {
    normaliseCurrency, tidyLabel, restorePrecision, llmProviders, isStale, dropConflicts, toMidRates, ScrapingService
} from '../services/ScrapingService.js';
import Rate from '../models/Rate.js';

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

    it('fails a page whose rates are all dated too old', async () => {
        // FBC's forex page, still listing RTGS$ cross rates dated 28-07-22.
        const old = [{ currency: 'GBP', rate: 0.83, name: 'Middle Rate', updated_at: null, page_date: '2022-07-28' }];
        stub({ staticPage: PAGE, browserPage: PAGE, staticRates: old, browserRates: old });

        const result = await ScrapingService.testSource('https://example.com');

        expect(result.ok).toBe(false);
        expect(result.attempts[0].error).toMatch(/dates its rates 2022-07-28, more than 7 days ago/);
    });
});

describe('dropConflicts', () => {

    it('drops a row the page gives twice with values that disagree', () => {
        // CABS: BWP from the USD table (USD per BWP) and the ZiG cross table.
        const { kept, conflicts } = dropConflicts([
            { currency: 'BWP', rate: 0.0665, name: 'Buy' },
            { currency: 'BWP', rate: 13.774209, name: 'Buy' },
            { currency: 'BWP', rate: 13.378392, name: 'Sell' },
        ]);

        expect(conflicts.map(r => r.rate)).toEqual([0.0665, 13.774209]);
        expect(kept.map(r => r.rate)).toEqual([13.378392]);
    });

    it('treats labels that differ only in currency words as the same row', () => {
        const { conflicts } = dropConflicts([
            { currency: 'ZWG', rate: 25.974026, name: 'USD Buy' },
            { currency: 'ZWG', rate: 40, name: 'ZiG Buy' },
        ]);
        expect(conflicts).toHaveLength(2);
    });

    it('keeps repeats that agree to within rounding', () => {
        const { kept, conflicts } = dropConflicts([
            { currency: 'ZWG', rate: 25.974026, name: 'Buy' },
            { currency: 'ZWG', rate: 25.974, name: 'Buy' },
        ]);
        expect(conflicts).toHaveLength(0);
        expect(kept).toHaveLength(2);
    });
});

describe('toMidRates', () => {

    const zwg = (name, rate) => ({ currency: 'ZWG', name, rate, updated_at: null, page_date: '2026-10-06' });
    const byName = (rates) => Object.fromEntries(rates.map(r => [r.name, r.rate]));

    it('replaces a bank\'s buy and sell with their midpoint', () => {
        // CABS, 6 October 2026
        const rates = toMidRates([
            zwg('Buy', 25.974026), zwg('Buy Cash', 25.906736),
            zwg('Sell', 27.472527), zwg('Sell Cash', 27.548209),
        ]);

        expect(byName(rates)).toEqual({ 'Mid': 26.723277, 'Mid Cash': 26.727473 });
    });

    it('keeps the page\'s own middle rate and drops the two sides', () => {
        // FBC's columns
        const rates = toMidRates([
            { ...zwg('Buying Rate', 16.23), currency: 'ZAR' },
            { ...zwg('Middle Rate', 16.9), currency: 'ZAR' },
            { ...zwg('Selling Rate', 17.58), currency: 'ZAR' },
        ]);

        expect(byName(rates)).toEqual({ 'Middle Rate': 16.9 });
    });

    it('leaves rows with no side, and sides without a partner, as they are', () => {
        // Zim Price Check: Street Value and Street Cost are different rows.
        const page = [
            zwg('Official', 26.7583), zwg('cash rate', 40),
            zwg('Street Value (Sell USD)', 30), zwg('Street Cost (Buy USD)', 33),
        ];

        expect(byName(toMidRates(page))).toEqual(byName(page));
    });

    it('pairs sides the model marked, however the site words them', () => {
        // The same CABS quote after a redesign that dropped "Buy" and "Sell".
        const rates = toMidRates([
            { ...zwg('We pay you', 25.974026), side: 'buy', row: 'transfer' },
            { ...zwg('You pay us', 27.472527), side: 'sell', row: 'transfer' },
        ]);

        expect(byName(rates)).toEqual({ 'We pay you / You pay us': 26.723277 });
    });

    it('names a midpoint the same whichever side the model called buy', () => {
        // Zim Price Check's street pair: the side words do not line up, so the
        // name is both labels, in an order that does not depend on the model.
        const street = (costSide, valueSide) => toMidRates([
            { ...zwg('Street Cost (Buy USD)', 33), side: costSide, row: 'street' },
            { ...zwg('Street Value (Sell USD)', 30), side: valueSide, row: 'street' },
        ]);

        expect(byName(street('buy', 'sell'))).toEqual({ 'Street Cost (Buy USD) / Street Value (Sell USD)': 31.5 });
        expect(byName(street('sell', 'buy'))).toEqual(byName(street('buy', 'sell')));
    });

    it('keeps the CABS names when the model marks the sides itself', () => {
        const rates = toMidRates([
            { ...zwg('Buy', 25.974026), side: 'buy', row: 'standard' },
            { ...zwg('Sell', 27.472527), side: 'sell', row: 'standard' },
            { ...zwg('Buy Cash', 25.906736), side: 'buy', row: 'cash' },
            { ...zwg('Sell Cash', 27.548209), side: 'sell', row: 'cash' },
        ]);

        expect(byName(rates)).toEqual({ 'Mid': 26.723277, 'Mid Cash': 26.727473 });
    });

    it('leaves a range alone when the model marks no sides', () => {
        const page = [zwg('lowest informal-sector rate', 33), zwg('highest informal-sector rate', 30)];

        expect(byName(toMidRates(page))).toEqual(byName(page));
    });

    it('pairs only within a currency', () => {
        const rates = toMidRates([zwg('Buy', 25.97), { ...zwg('Sell', 16.52), currency: 'ZAR' }]);

        expect(byName(rates)).toEqual({ Buy: 25.97, Sell: 16.52 });
    });
});

describe('ScrapingService.advanceProbation', () => {

    const daysAgo = (days) => DateTime.now().minus({ days }).toJSDate();

    beforeEach(() => vi.spyOn(Rate, 'setProbation').mockResolvedValue());
    afterEach(() => vi.restoreAllMocks());

    it('promotes a source clean for the whole probation period', async () => {
        const source = { id: 's', url: 'u', probation: true, clean_since: daysAgo(8) };

        expect(await ScrapingService.advanceProbation(source, [{ action: 'updated' }])).toEqual([{ action: 'promoted' }]);
        expect(source.probation).toBe(false);
        expect(Rate.setProbation).toHaveBeenCalledWith('s', false);
    });

    it('waits out the rest of the period', async () => {
        const source = { id: 's', url: 'u', probation: true, clean_since: daysAgo(3) };

        expect(await ScrapingService.advanceProbation(source, [{ action: 'updated' }])).toEqual([]);
        expect(source.probation).toBe(true);
    });

    it('restarts the clean run when a reading is refused', async () => {
        const source = { id: 's', url: 'u', probation: true, clean_since: daysAgo(30) };

        await ScrapingService.advanceProbation(source, [{ action: 'updated' }, { action: 'rejected' }]);

        expect(source.probation).toBe(true);
        expect(source.clean_since.getTime()).toBeGreaterThan(daysAgo(1).getTime());
        expect(Rate.setProbation).not.toHaveBeenCalled();
    });
});

describe('isStale', () => {

    const now = DateTime.fromISO('2026-10-06T12:00:00');

    it('judges a rate by the page date when it has no timestamp of its own', () => {
        expect(isStale({ page_date: '2022-07-28' }, 7, now)).toBe(true);
        expect(isStale({ page_date: '2026-10-06' }, 7, now)).toBe(false);
    });

    it('prefers the rate\'s own timestamp to the page date', () => {
        expect(isStale({ updated_at: '2026-10-05T09:00:00', page_date: '2022-07-28' }, 7, now)).toBe(false);
        expect(isStale({ updated_at: '2026-09-01T09:00:00', page_date: '2026-10-06' }, 7, now)).toBe(true);
    });

    it('does not judge a rate with no usable date', () => {
        expect(isStale({}, 7, now)).toBe(false);
        expect(isStale({ page_date: 'last week' }, 7, now)).toBe(false);
    });
});

describe('llmProviders', () => {

    const MAIN = { LLM_API_KEY: 'g-key', LLM_API_URL: 'https://gemini.test/v1beta/openai/chat/completions', LLM_MODEL: 'gemini-x' };
    const BACKUP = { LLM_BACKUP_API_KEY: 'd-key', LLM_BACKUP_API_URL: 'https://deepseek.test', LLM_BACKUP_MODEL: 'deepseek-x' };

    afterEach(() => vi.unstubAllEnvs());

    const stubEnv = (vars) => {
        for (const name of [...Object.keys(MAIN), ...Object.keys(BACKUP), 'LLM_EXTRA_BODY', 'LLM_BACKUP_EXTRA_BODY']) {
            vi.stubEnv(name, vars[name] ?? '');
        }
    };

    it('lists main then backup, with the chat-completions path stripped', () => {
        stubEnv({ ...MAIN, ...BACKUP });

        expect(llmProviders()).toEqual([
            { label: 'main', model: 'gemini-x', apiKey: 'g-key', baseURL: 'https://gemini.test/v1beta/openai', extraBody: {} },
            { label: 'backup', model: 'deepseek-x', apiKey: 'd-key', baseURL: 'https://deepseek.test', extraBody: {} },
        ]);
    });

    it('runs without a backup when none is configured', () => {
        stubEnv(MAIN);
        expect(llmProviders().map(p => p.label)).toEqual(['main']);
    });

    it('refuses a missing or half-configured provider', () => {
        stubEnv(BACKUP);
        expect(() => llmProviders()).toThrow(/LLM_API_KEY, LLM_API_URL and LLM_MODEL/);

        stubEnv({ ...MAIN, LLM_BACKUP_API_KEY: 'd-key' });
        expect(() => llmProviders()).toThrow(/LLM_BACKUP_API_KEY, LLM_BACKUP_API_URL and LLM_BACKUP_MODEL/);
    });

    it('parses extra body params for the provider they are set on only', () => {
        stubEnv({ ...MAIN, ...BACKUP, LLM_BACKUP_EXTRA_BODY: '{"thinking":{"type":"disabled"}}' });

        const [main, backup] = llmProviders();
        expect(main.extraBody).toEqual({});
        expect(backup.extraBody).toEqual({ thinking: { type: 'disabled' } });
    });

    it.each(['{thinking: disabled}', '["thinking"]', '"disabled"'])(
        'refuses extra body that is not a JSON object: %s',
        (raw) => {
            stubEnv({ ...MAIN, LLM_EXTRA_BODY: raw });
            expect(() => llmProviders()).toThrow('LLM_EXTRA_BODY must be a JSON object');
        },
    );
});

describe('ScrapingService.extractRates', () => {

    const RATES = [{ currency: 'ZWG', rate: 26.5, name: 'Official', updated_at: null }];

    beforeEach(() => {
        vi.stubEnv('LLM_API_KEY', 'g-key');
        vi.stubEnv('LLM_API_URL', 'https://gemini.test');
        vi.stubEnv('LLM_MODEL', 'gemini-x');
        vi.stubEnv('LLM_BACKUP_API_KEY', 'd-key');
        vi.stubEnv('LLM_BACKUP_API_URL', 'https://deepseek.test');
        vi.stubEnv('LLM_BACKUP_MODEL', 'deepseek-x');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('uses the main provider alone when it succeeds', async () => {
        const run = vi.spyOn(ScrapingService, 'extractRatesWith').mockResolvedValue(RATES);

        expect(await ScrapingService.extractRates('page', 'https://example.com')).toEqual(RATES);
        expect(run.mock.calls.map(([p]) => p.label)).toEqual(['main']);
    });

    it('reruns with the backup when the main provider fails', async () => {
        const run = vi.spyOn(ScrapingService, 'extractRatesWith')
            .mockRejectedValueOnce(new Error('429 quota exceeded'))
            .mockResolvedValueOnce(RATES);

        expect(await ScrapingService.extractRates('page', 'https://example.com')).toEqual(RATES);
        expect(run.mock.calls.map(([p]) => p.model)).toEqual(['gemini-x', 'deepseek-x']);
    });

    it('reports both failures when the backup fails too', async () => {
        vi.spyOn(ScrapingService, 'extractRatesWith')
            .mockRejectedValueOnce(new Error('503 high demand'))
            .mockRejectedValueOnce(new Error('401 invalid key'));

        await expect(ScrapingService.extractRates('page', 'https://example.com')).rejects.toThrow(
            'main LLM (gemini-x): 503 high demand | backup LLM (deepseek-x): 401 invalid key'
        );
    });

    it('does not fall back on an empty result', async () => {
        // No rates is an answer, not a failure: testSource relies on it to try
        // the browser fetch, and the backup reading the same page would agree.
        const run = vi.spyOn(ScrapingService, 'extractRatesWith').mockResolvedValue([]);

        expect(await ScrapingService.extractRates('page', 'https://example.com')).toEqual([]);
        expect(run).toHaveBeenCalledTimes(1);
    });
});
