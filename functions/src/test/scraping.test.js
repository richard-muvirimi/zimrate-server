/**
 * The deterministic half of rate extraction — the rules that hold whatever the
 * model returns. The model's own output is checked by hand against the live API;
 * these are the guards that must not depend on it.
 */
import { vi, describe, it, expect } from 'vitest';

vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

import { normaliseCurrency, tidyLabel } from '../services/ScrapingService.js';

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
