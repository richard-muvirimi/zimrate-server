/**
 * Best-effort guess at the visitor's currency, used to pick a sensible default
 * in the converter instead of a hardcoded one.
 *
 * Two strategies, in order:
 *  1. `Intl.Locale.prototype.getCurrencies()` — exact, but it is the Intl Locale
 *     Info proposal and is missing in several engines, so it cannot be relied on.
 *  2. Region from `maximize()` mapped through the table below. The table only
 *     needs to cover currencies the API actually quotes; anything else falls
 *     through to the caller's fallback.
 */

const REGION_CURRENCY: Record<string, string> = {
  // Zimbabwe and neighbours
  ZW: 'ZWG',
  ZA: 'ZAR',
  BW: 'BWP',
  ZM: 'ZMW',
  TZ: 'TZS',
  NG: 'NGN',
  MW: 'MWK',
  MZ: 'MZN',
  // Major quote currencies
  US: 'USD',
  GB: 'GBP',
  AU: 'AUD',
  NZ: 'NZD',
  CN: 'CNY',
  JP: 'JPY',
  CA: 'CAD',
  CH: 'CHF',
  IN: 'INR',
  // Eurozone
  AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR',
  FI: 'EUR', FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR',
  LT: 'EUR', LU: 'EUR', LV: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR',
  SI: 'EUR', SK: 'EUR',
};

interface LocaleWithCurrencies extends Intl.Locale {
  getCurrencies?: () => string[];
}

export function detectLocaleCurrency(): string | null {
  if (typeof navigator === 'undefined') return null;

  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const tag of languages) {
    if (!tag) continue;
    try {
      const locale = new Intl.Locale(tag).maximize() as LocaleWithCurrencies;

      const currencies = locale.getCurrencies?.();
      if (Array.isArray(currencies) && currencies[0]) return currencies[0];

      const region = locale.region;
      if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    } catch {
      // Malformed tag — try the next one.
    }
  }

  return null;
}

export default detectLocaleCurrency;
