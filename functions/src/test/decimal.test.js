/**
 * The arithmetic every published rate passes through. These are the guarantees
 * the float versions could not make — a mean that lands on the figure the sum
 * says it is, and a division carried to a stated precision rather than to the
 * nearest double.
 */
import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { mean, median } from '../utils/decimal.js';

describe('mean', () => {

    it('averages without the float residue', () => {
        // _.meanBy answered 0.15000000000000002 here, and that residue was stored
        // as the rate: a currency quoted a fraction off what it averaged.
        expect(mean([0.1, 0.2]).toString()).toBe('0.15');
    });

    it('averages a group of rates', () => {
        expect(mean([26.5, 28, 30, 32]).toNumber()).toBe(29.125);
    });
});

describe('median', () => {

    it('averages the two middle values on an even-sized set', () => {
        expect(median([26.5, 28, 30, 32]).toNumber()).toBe(29);
    });

    it('takes the middle value on an odd-sized set', () => {
        expect(median([30, 26.5, 28]).toNumber()).toBe(28);
    });

    it('does not depend on the order it is given', () => {
        expect(median([32, 26.5, 30, 28]).toNumber()).toBe(29);
    });
});

describe('cross-rate division', () => {

    it('carries more digits than a double can hold', () => {
        // 26.6291 / 16.648 — the float answer stops at 1.5995374819798176.
        expect(new Decimal(26.6291).div(16.648).toString()).toBe('1.5995374819798173955');
    });
});
