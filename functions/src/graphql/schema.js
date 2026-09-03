import { RateService } from '../services/RateService.js';

// GraphQL enums must declare at least one value, so an empty rates collection
// would otherwise generate `enum Currency {}` and fail schema parsing. This
// sentinel keeps the schema valid; it matches no rate, so querying it returns
// an empty list — which is the right answer when there is no data.
const NO_CURRENCIES = 'NONE';

export async function createTypeDefs() {
  const currencies = await RateService.getKnownCurrencies();

  // Create enum values from currencies
  const currencyEnumValues = currencies.length > 0
    ? currencies.join('\n    ')
    : NO_CURRENCIES;

  // Base is what rates are quoted *against*, a different set from the currencies
  // that can be quoted: USD always belongs, because every stored rate is already
  // per 1 USD and USD itself never appears in the rates collection. That also
  // keeps this enum valid on an empty collection, so it needs no sentinel.
  const baseEnumValues = ['USD', ...currencies.filter(c => c !== 'USD')].join('\n      ');

  return `
    type Query {
      rate(
        search: String
        date: Int
        currency: Currency
        base: Base
        prefer: Prefer
      ): [Rate!]!
      info: String!
    }

    type Rate {
      currency: String!
      last_checked: Int!
      last_updated: Int!
      name: String
      rate: Float!
      last_rate: Float!
      url: String
    }

    enum Currency {
      ${currencyEnumValues}
    }

    enum Base {
      ${baseEnumValues}
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
