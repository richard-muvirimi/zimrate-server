import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Registry of the options the app actually reads.
 *
 * Options live in Firestore as auto-id documents carrying the name in a `key`
 * FIELD and the value in a `value` FIELD — values are always strings, so
 * booleans are the literal 'true' / 'false'.
 *
 * Before this registry the settings screen inferred each control from the
 * value's shape and could only edit keys that already existed, which meant an
 * option nobody had written by hand was simply unreachable.
 */
export type OptionType = 'boolean' | 'text' | 'longtext' | 'number';
export type OptionGroup = 'General' | 'Security' | 'Scraping' | 'Display';

export interface OptionDef {
  key: string;
  label: string;
  description: string;
  group: OptionGroup;
  type: OptionType;
  fallback: string;
}

export const OPTION_GROUPS: OptionGroup[] = ['General', 'Security', 'Scraping', 'Display'];

export const REGISTRATION_KEY = 'registration_enabled';
export const PER_PAGE_KEY = 'admin_per_page';
export const DEFAULT_PER_PAGE = 25;
export const PER_PAGE_CHOICES = [10, 25, 50, 100];
export const PER_PAGE_STORAGE_KEY = 'zimrate-admin-per-page';

export const KNOWN_OPTIONS: OptionDef[] = [
  {
    key: 'info',
    label: 'API notice',
    description:
      'Returned as the "info" field by the REST and GraphQL APIs, and shown as a caption under the rates heading on the public site. Use it to announce maintenance or data issues.',
    group: 'General',
    type: 'longtext',
    fallback: 'ZimRate API - Real-time Zimbabwe exchange rates',
  },
  {
    key: 'scraping_enabled',
    label: 'Scraping enabled',
    description:
      'When off, the hourly scheduled scrape skips every run without needing a redeploy. Rates already stored stay served; they just stop being refreshed.',
    group: 'Scraping',
    type: 'boolean',
    fallback: 'true',
  },
  {
    key: 'local_currency_code',
    label: 'Local currency code',
    description:
      'The currency treated as local when extracting rates. It is injected into the AI extraction prompt and the cross-rate conversion tool, so changing it re-targets how every source is interpreted.',
    group: 'Scraping',
    type: 'text',
    fallback: 'ZWG',
  },
  {
    key: 'rate_freshness_months',
    label: 'Serve rates for (months)',
    description:
      'How long a rate keeps being returned by the API after the last scrape that found it on its '
      + 'source page. A rate missing from one scrape is not dropped — it simply stops being '
      + 'refreshed, and consumers can see how old it is from last_updated until this window ends.',
    group: 'Scraping',
    type: 'number',
    fallback: '3',
  },
  {
    key: 'rate_retention_months',
    label: 'Delete rates after (months)',
    description:
      'How long a rate is kept in the database after it stops being seen. Deleting destroys its '
      + 'change history, so keep this comfortably longer than the serving window — a value shorter '
      + 'than that one is ignored rather than allowed to delete rates still being served.',
    group: 'Scraping',
    type: 'number',
    fallback: '12',
  },
  {
    key: REGISTRATION_KEY,
    label: 'Account registration',
    description:
      'Allows new accounts to be created from the Users page. Turn this off once your admins '
      + 'exist: it is enforced by the API, not just hidden in the UI, so no signed-in admin — or '
      + 'anyone using a stolen admin token — can mint new accounts while it is off.',
    group: 'Security',
    type: 'boolean',
    fallback: 'true',
  },
  {
    key: PER_PAGE_KEY,
    label: 'Rows per page',
    description:
      'How many records each admin list shows per page. Applies to Rates, Sources and Users.',
    group: 'Display',
    type: 'number',
    fallback: String(DEFAULT_PER_PAGE),
  },
];

export function findOptionDef(key: string): OptionDef | undefined {
  return KNOWN_OPTIONS.find((o) => o.key === key);
}

/** Clamped so a bad stored value can't produce a pathological query. */
export function parsePerPage(raw: string | undefined | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 5 || n > 200) return DEFAULT_PER_PAGE;
  return n;
}

export interface LoadedOption {
  /** Firestore document id — only needed to write back. */
  id: string;
  key: string;
  value: string;
}

let cache: Promise<LoadedOption[]> | null = null;

/**
 * Options are read by several admin pages. Caching the promise at module scope
 * means one `getDocs` per session rather than one per page mount.
 */
export function loadOptions(): Promise<LoadedOption[]> {
  if (!cache) {
    cache = getDocs(collection(db, 'options'))
      .then((snap) =>
        snap.docs.map((d) => ({
          id: d.id,
          // Docs use auto-ids; falling back to the id would show a random
          // Firestore id where the option name should be.
          key: (d.data().key as string) ?? d.id,
          value: (d.data().value as string) ?? '',
        })),
      )
      .catch((err) => {
        // Don't poison the cache — a permissions blip should be retryable.
        cache = null;
        throw err;
      });
  }
  return cache;
}

export function invalidateOptions(): void {
  cache = null;
}

/** Convenience: option values as a plain key -> value map, with fallbacks applied. */
export async function loadOptionValues(): Promise<Record<string, string>> {
  const loaded = await loadOptions();
  const map: Record<string, string> = {};
  for (const def of KNOWN_OPTIONS) map[def.key] = def.fallback;
  for (const o of loaded) map[o.key] = o.value;
  return map;
}
