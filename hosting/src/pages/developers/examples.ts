import type { RestVersion } from './types';

/**
 * Request and response samples shown on the Developers page.
 *
 * The response samples are hand-written to match what each endpoint actually
 * returns — see the note on v1 below. A sample promising fields the request
 * would not return is worse than no sample at all.
 */

export const restRequest = (restUrl: string) =>
  [`curl -X POST ${restUrl} \\`, "  -d 'prefer=mean' \\", "  -d 'currency=ZWG'"].join('\n');

/**
 * v1 trims fields in RateService.getRates: name and url appear only when
 * `prefer` is absent, and last_rate only with `extra`. This request sets
 * `prefer`, so neither is present here.
 */
export const REST_RESPONSE = [
  '{',
  '  "USD": [',
  '    {',
  '      "currency": "ZWG",',
  '      "last_checked": 1774000000,',
  '      "last_updated": 1773996400,',
  '      "rate": 26.5',
  '    }',
  '  ],',
  '  "info": "ZimRate API - Real-time Zimbabwe exchange rates"',
  '}',
].join('\n');

/** base is a path segment on v2, and the url is case insensitive. */
export const restV2Request = (restV2Url: string) => `curl '${restV2Url}/ZAR'`;

/** v2 does not trim fields, so every rate carries the full record. */
export const REST_V2_RESPONSE = [
  '{',
  '  "base": "ZAR",',
  '  "rates": [',
  '    {',
  '      "currency": "ZWG",',
  '      "name": "RBZ - ZWG",',
  '      "last_checked": 1774000000,',
  '      "last_updated": 1773996400,',
  '      "rate": 1.4324,',
  '      "last_rate": 1.4054,',
  '      "url": "https://rbz.co.zw"',
  '    }',
  '  ],',
  '  "info": "ZimRate API - Real-time Zimbabwe exchange rates"',
  '}',
].join('\n');

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
