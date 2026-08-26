import Rate from '../models/Rate.js';
import { getCache, setCache } from '../utils/cache.js';
import { DateTime } from 'luxon';

async function getUniqueCurrencies() {
  const cached = await getCache('currencies');
  if (cached) return cached;

  const currencies = await Rate.getUniqueCurrencies();
  await setCache('currencies', currencies, DateTime.now().plus({ minutes: 5 }));
  return currencies;
}

// GraphQL enums must declare at least one value, so an empty rates collection
// would otherwise generate `enum Currency {}` and fail schema parsing. This
// sentinel keeps the schema valid; it matches no rate, so querying it returns
// an empty list — which is the right answer when there is no data.
const NO_CURRENCIES = 'NONE';

export async function createTypeDefs() {
  const currencies = await getUniqueCurrencies();

  // Create enum values from currencies
  const currencyEnumValues = currencies.length > 0
    ? currencies.join('\n    ')
    : NO_CURRENCIES;

  return `
    type Query {
      rate(
        search: String
        date: Int
        currency: Currency
        prefer: Prefer
      ): [Rate!]
      info: String
    }

    type Rate {
      currency: String
      last_checked: Int
      last_updated: Int
      name: String
      rate: Float
      last_rate: Float
      url: String
    }

    enum Currency {
      ${currencyEnumValues}
    }

    enum Prefer {
      MIN
      MAX
      MEAN
      MEDIAN
      RANDOM
      MODE
    }
  `;
}
