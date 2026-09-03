import Rate from '../models/Rate.js';
import { getCache, setCache } from '../utils/cache.js';
import { DateTime } from 'luxon';
import _ from 'lodash';

/**
 * A base currency that cannot be served: unknown, or quoted at zero.
 * Carries the HTTP status the REST layer answers with; GraphQL surfaces only
 * the message.
 */
export class BaseRateError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'BaseRateError';
        this.status = status;
    }
}

/**
 * Base-relative output filters, applied in memory on Rate models before toAPI().
 *
 * In memory rather than in the Firestore query because the cross rate needs the
 * base currency's own rates to compute its divisor — filtering at query time can
 * remove them and turn a valid request into a 404.
 *
 * Runs before toAPI() so rate_updated_at is still a Date rather than the unix
 * integer toAPI() converts it to.
 */
function applyFilters(rates, { currency, search, name, date, freshnessCutoff }) {
    // The unscoped read below is for the divisor's benefit, not the caller's: a
    // rate too stale for v1 to serve must not reach a v2 response either, or the
    // same rate would be live on one endpoint and gone from the other. Rates kept
    // past their freshness window for their history are dropped here.
    let result = rates.filter(r => r.updated_at && r.updated_at > freshnessCutoff);

    if (currency) {
        result = result.filter(r => r.rate_currency === currency);
    }

    // search and name are aliases, and validation rejects passing both.
    const term = search || name;
    if (term) {
        const needle = term.toLowerCase();
        result = result.filter(r => (r.rate_name || '').toLowerCase().includes(needle));
    }

    if (date) {
        const after = DateTime.fromSeconds(date).toJSDate();
        result = result.filter(r => r.rate_updated_at && r.rate_updated_at > after);
    }

    return result;
}

export class RateService {
    /**
     * The currency codes the API currently serves, cached for five minutes.
     *
     * Shared by the REST currency check and the GraphQL Currency enum so the two
     * agree on what exists and read it through one cache entry.
     */
    static async getKnownCurrencies() {
        const cached = await getCache('currencies');
        if (cached) return cached;

        const currencies = await Rate.getUniqueCurrencies();
        await setCache('currencies', currencies, DateTime.now().plus({ minutes: 5 }));
        return currencies;
    }

    static async getRates(params = {}) {
        const {
            search,
            name,
            source, // deprecated
            currency,
            date,
            prefer,
            extra = false
        } = params;

        const filters = {
            enabled: true
        };

        // Apply search filters
        if (search || name || source) {
            filters.search = search || name || source;
        }

        if (currency) {
            filters.currency = currency;
        }

        if (date) {
            filters.dateAfter = date;
        }

        let rates;
        if (prefer) {
            rates = await Rate.getAggregatedRates(prefer, filters);
        } else {
            rates = await Rate.findAll(filters);
        }

        // Transform to API format
        return rates.map(rate => {
            const apiRate = rate.toAPI();

            // Determine which fields to include
            const fields = ['currency', 'last_checked', 'last_updated', 'rate'];

            if (!prefer) {
                fields.push('name', 'url');
            }

            if (extra) {
                fields.push('last_rate');
            }

            // Filter the response to only include requested fields
            return _.pick(apiRate, fields);
        });
    }

    /**
     * Rates expressed against a base currency, in API form.
     *
     * Algorithm (cross-multiplication):
     *   All stored rates are expressed as units of foreign currency per 1 USD.
     *   To express currency X relative to base B:
     *     rate_X_per_B = rate_X_per_USD / rate_B_per_USD
     *
     * Example: ZWG/USD=26, ZAR/USD=18.5
     *   ZWG per ZAR = 26 / 18.5 = 1.405  (1 ZAR buys 1.405 ZWG)
     *
     * Shared by REST v2 and the GraphQL `base` argument so the two cannot drift.
     *
     * @throws {BaseRateError} when the base has no rates, or its rate is zero
     */
    static async getRatesForBase({ base, prefer, currency, search, name, date }) {
        // Deliberately unfiltered. User filters are applied to the OUTPUT below,
        // never here: narrowing the query first can remove the base currency's
        // own rates, which is what the divisor is computed from — that made
        // `currency` 404 for every non-USD base. No updated scope either, so the
        // cross rates are computed from a full picture.
        const filters = { enabled: true, applyUpdatedScope: false };

        const allRates = prefer
            ? await Rate.getAggregatedRates(prefer, filters)
            : await Rate.findAll(filters);

        // Read once and shared by both exits below, so every row in one response
        // is judged against the same instant.
        const freshnessCutoff = await Rate.freshnessCutoff();

        // USD is the native base, so its rates need no conversion.
        if (base === 'USD') {
            return applyFilters(allRates, { currency, search, name, date, freshnessCutoff }).map(r => r.toAPI());
        }

        const baseRates = allRates.filter(r => r.rate_currency === base);
        if (baseRates.length === 0) {
            throw new BaseRateError(`No rates found for base currency: ${base}`, 404);
        }

        // Use mean of base rates if multiple (normalises across different sources)
        const rateUSDPerBase = _.meanBy(baseRates, 'rate');
        if (!rateUSDPerBase) {
            throw new BaseRateError(`Base currency rate for ${base} is zero or unavailable`, 422);
        }

        // Filters run after the divisor is known, so narrowing the output can
        // never starve the cross-rate maths. The base currency is dropped from
        // the results: expressed against itself it is always 1.
        return applyFilters(allRates, { currency, search, name, date, freshnessCutoff })
            .filter(r => r.rate_currency !== base)
            .map(r => {
                if (!r.rate) return null;
                const crossRate = r.rate / rateUSDPerBase;
                return {
                    ...r.toAPI(),
                    rate: crossRate,
                    last_rate: r.last_rate ? r.last_rate / rateUSDPerBase : crossRate
                };
            })
            .filter(Boolean);
    }
}
