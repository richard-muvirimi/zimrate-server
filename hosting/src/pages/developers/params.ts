/**
 * Query parameter reference for the Graphql section.
 *
 * The REST parameters are not listed here: the rendered specification sits
 * directly below the REST examples and documents them in full, so a second
 * hand-maintained list would only be one more thing to keep in step. Graphql
 * has no such panel, which is why it keeps one.
 *
 * GRAPHQL_PARAMS mirrors `graphqlRateQuerySchema` in
 * functions/src/validation/schemas.js.
 */

export const PREFER_VALUES = ['MIN', 'MAX', 'MEAN', 'MEDIAN', 'RANDOM', 'MODE'];

export const GRAPHQL_PARAMS = ['search', 'currency', 'date', 'base', 'prefer'];

export function buildParamDocs({
  loading,
  currencyList,
}: {
  loading: boolean;
  currencyList: string;
}): Record<string, string> {
  return {
    base: 'The currency every rate is returned against, for example ZAR. Optional — leave it out and rates come back per 1 USD, as they always have. Accepts USD or any supported currency, and the base currency itself is left out of the results.',
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
