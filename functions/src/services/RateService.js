import Rate from '../models/Rate.js';
import _ from 'lodash';

export class RateService {
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
}
