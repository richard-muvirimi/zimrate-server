/** Request samples shown on the Developers page. */

/** The minimal call: no parameters, so it shows each version's default response. */
export const restRequest = (versionUrl: string) => `curl '${versionUrl}'`;

export function jsonpRequest(versionUrl: string) {
  return [
    'var s = document.createElement("script");',
    `s.src = "${versionUrl}?callback=myFunction";`,
    'document.body.appendChild(s);',
    '',
    'function myFunction(rates) {',
    '  console.log(rates);',
    '}',
  ].join('\n');
}

/**
 * Two aliases of one request: the default USD quote, and the same rates put
 * through `base` — the GraphQL equivalent of v2, and the only parameter that
 * changes what the numbers mean rather than which rows come back.
 *
 * A USD base would repeat the first alias, so it is swapped for the home
 * currency, as the calculator does for visitors already on USD.
 */
export function graphqlQuery(base: string) {
  const converted = base === 'USD' ? 'ZWG' : base;
  return [
    'query {',
    '  USD: rate(prefer: RANDOM) {',
    '    currency',
    '    last_checked',
    '    last_updated',
    '    rate',
    '  }',
    `  ${converted}: rate(base: ${converted}, prefer: RANDOM) {`,
    '    currency',
    '    rate',
    '  }',
    '  notice: info',
    '}',
  ].join('\n');
}
