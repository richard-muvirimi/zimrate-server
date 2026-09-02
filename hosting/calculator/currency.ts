/**
 * Currency → country, ported from the Android app's CurrencyFlagUtil.
 *
 * ISO 4217 codes are prefixed with their country code (USD→us, ZAR→za), which
 * covers all but the supranational currencies. Those get an explicit override,
 * the same representative-country approximation the app makes.
 */

const OVERRIDES: Record<string, string> = {
  EUR: 'eu',
  XAF: 'cm',
  XOF: 'sn',
  XCD: 'ag',
  XPF: 'pf',
  ANG: 'cw',
};

/** Currencies of this country are surfaced above the rest of the list. */
export const LOCAL_COUNTRY_CODE = 'zw';

/** Every rate is quoted per 1 USD, so USD is the base and is never converted. */
export const BASE_CURRENCY = 'USD';

export function countryCode(currency: string): string {
  const upper = currency.toUpperCase();
  return OVERRIDES[upper] ?? upper.slice(0, 2).toLowerCase();
}

/**
 * Localised country name, shown instead of the bare code because a code means
 * nothing to most people. Falls back to the code where no country resolves,
 * which includes EUR.
 */
export function countryName(currency: string): string {
  const region = countryCode(currency).toUpperCase();

  try {
    const name = new Intl.DisplayNames(navigator.languages as string[], { type: 'region' }).of(region);
    if (name && name.toLowerCase() !== region.toLowerCase()) return name;
  } catch {
    /* Unknown region, or no Intl data for it. */
  }

  return currency.toUpperCase();
}

/**
 * The label a rate is shown under: "ZAR · South Africa", or just the code where
 * the two would repeat.
 *
 * A custom rate passes its own [name]: a code the user invented is not ISO, so
 * resolving it to a country would dress it in an unrelated flag and label —
 * OMIR would come back as Oman.
 */
export function currencyLabel(currency: string, name?: string): string {
  const code = currency.toUpperCase();
  const resolved = name?.trim() || countryName(currency);

  return resolved.toLowerCase() === code.toLowerCase() ? code : `${code} · ${resolved}`;
}

/** URL of the flag for a currency, or null for one the user invented. */
export function flagUrl(currency: string, custom = false): string | null {
  return custom ? null : `/calculator/flags/${countryCode(currency)}.svg`;
}
