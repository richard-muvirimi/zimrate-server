/**
 * Query parameter reference for every api on the Developers page.
 *
 * The descriptions live here once and each section renders the subset its
 * endpoint accepts. Three copies of this prose is how the v1, v2 and Graphql
 * lists would quietly drift apart.
 *
 * These lists mirror the Joi schemas in functions/src/validation/schemas.js —
 * `rateQuerySchema`, `v2QuerySchema` and `graphqlRateQuerySchema` respectively.
 * If a parameter is added there, add it here.
 */

export const PREFER_VALUES = ['MIN', 'MAX', 'MEAN', 'MEDIAN', 'RANDOM', 'MODE'];

export const V1_PARAMS = [
  'search', 'name', 'source', 'currency', 'date', 'prefer', 'callback', 'extra', 'info',
];

export const V2_PARAMS = [
  'base', 'search', 'name', 'currency', 'date', 'prefer', 'callback', 'info',
];

export const GRAPHQL_PARAMS = ['search', 'currency', 'date', 'prefer'];

export function buildParamDocs({
  loading,
  currencyList,
}: {
  loading: boolean;
  currencyList: string;
}): Record<string, string> {
  return {
    base: 'The currency every rate is returned against, for example ZAR. Must be one of the supported currencies. Requests without it are rejected.',
    search: 'Allows you to get currency rates using only part of a currency or source name.',
    name: 'An alias of search. Pass one or the other, not both.',
    source: 'Deprecated, use name instead. Cannot be combined with search or name.',
    currency: loading
      ? 'Can only be one of the supported currencies. Loading the current list...'
      : `Can only be one of: ${currencyList || 'none yet'}. Use this when you require a specific currency.`,
    date: 'When provided, only matching rates after this date will be returned. Accepts common date formats, though a Unix timestamp is preferred.',
    prefer: `Can only be one of ${PREFER_VALUES.join(', ')} or empty to return the whole list.`,
    callback: 'Wraps the response in a call to a function of this name, for JSONP. Supported by both versions.',
    extra: 'Includes last_rate in each result. Version 2 always returns it, so it has no equivalent there.',
    info: 'Set to false to leave the system notice out of the response.',
  };
}
