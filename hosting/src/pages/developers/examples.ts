import type { RestVersion } from './types';

/** Request samples shown on the Developers page. */

/** The minimal call: no parameters, so it shows each version's default response. */
export const restRequest = (versionUrl: string) => `curl '${versionUrl}'`;

export function jsonpRequest(versionUrl: string, version: RestVersion) {
  // v2 carries its base currency in the path, so the url gains a segment.
  const url = version === 'v2' ? `${versionUrl}/ZAR?callback=myFunction` : `${versionUrl}?callback=myFunction`;
  return [
    'var s = document.createElement("script");',
    `s.src = "${url}";`,
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
 */
export const GRAPHQL_QUERY = [
  'query {',
  '  USD: rate(prefer: RANDOM) {',
  '    currency',
  '    last_checked',
  '    last_updated',
  '    rate',
  '  }',
  '  ZAR: rate(base: ZAR, prefer: RANDOM) {',
  '    currency',
  '    rate',
  '  }',
  '  notice: info',
  '}',
].join('\n');
