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
export type OptionGroup = 'General' | 'Security' | 'Scraping' | 'Discovery' | 'Display';

export interface OptionDef {
  key: string;
  label: string;
  description: string;
  group: OptionGroup;
  type: OptionType;
  fallback: string;
}

export const OPTION_GROUPS: OptionGroup[] = ['General', 'Security', 'Scraping', 'Discovery', 'Display'];

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
    key: 'rate_freshness_days',
    label: 'Serve rates for (days)',
    description:
      'How long a rate keeps being returned by the API after the last scrape that found it on its '
      + 'source page, while that source keeps failing. A source that scrapes successfully for a day '
      + 'without a rate — the row was removed or renamed — stops serving it sooner than this.',
    group: 'Scraping',
    type: 'number',
    fallback: '7',
  },
  {
    key: 'source_max_age_days',
    label: 'Refuse pages older than (days)',
    description:
      'A scraped rate is not stored when its page dates it older than this, so an abandoned page '
      + 'that still lists years-old figures cannot skew the aggregates. A source whose whole page is '
      + 'that old is marked as failing with the date it gave. Pages that show no date are accepted.',
    group: 'Scraping',
    type: 'number',
    fallback: '7',
  },
  {
    key: 'consensus_tolerance',
    label: 'Consensus tolerance (×)',
    description:
      'How far a scraped rate may sit from the consensus of the other trusted sources before it is '
      + 'refused: 2 accepts anything from half to double the consensus. Rates quoted the wrong way '
      + 'up (USD per EUR instead of EUR per USD) are refused regardless.',
    group: 'Scraping',
    type: 'number',
    fallback: '2',
  },
  {
    key: 'rate_jump_percent',
    label: 'Hold back jumps over (%)',
    description:
      'A stored rate whose new reading moves further than this in one scrape keeps its old value '
      + 'until the next scrape gives the same figure again. Catches the AI filing one row’s value '
      + 'under another’s label; a genuine move is stored an hour late.',
    group: 'Scraping',
    type: 'number',
    fallback: '20',
  },
  {
    key: 'probation_days',
    label: 'Probation period (days)',
    description:
      'A source on probation is scraped but not served. It is promoted once it has gone this many '
      + 'days without a failed scrape or a refused rate; either restarts the count.',
    group: 'Scraping',
    type: 'number',
    fallback: '7',
  },
  {
    key: 'discovery_enabled',
    label: 'Weekly source discovery',
    description:
      'Searches Google every Monday for pages that may publish rates and lists them under Candidates '
      + 'for review. Each run spends Apify credit on the search and on testing every new candidate.',
    group: 'Discovery',
    type: 'boolean',
    fallback: 'false',
  },
  {
    key: 'discovery_queries',
    label: 'Search queries',
    description: 'One Google search per line. Results are searched as from Zimbabwe.',
    group: 'Discovery',
    type: 'longtext',
    fallback: [
      'ZiG exchange rate today',
      'ZWG USD exchange rate',
      'Zimbabwe bank exchange rates ZiG',
      'Zimbabwe parallel market rate ZiG',
      'RBZ interbank rate ZWG',
    ].join('\n'),
  },
  {
    key: 'discovery_blocked_domains',
    label: 'Blocked domains',
    description:
      'One domain per line; its subdomains are blocked too. Crypto exchanges are listed by default '
      + 'because a token called ZIG trades on them, and its price reads like a ZiG rate.',
    group: 'Discovery',
    type: 'longtext',
    fallback: [
      'bybit.com', 'binance.com', 'coinmarketcap.com', 'coingecko.com', 'kucoin.com', 'okx.com',
      'mexc.com', 'gate.io', 'coinbase.com', 'google.com', 'youtube.com', 'facebook.com',
      'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'linkedin.com', 'reddit.com', 'wikipedia.org',
    ].join('\n'),
  },
  {
    key: 'discovery_max_candidates',
    label: 'New candidates per run',
    description:
      'The most new candidates one discovery run files. Each is tested with up to two page fetches '
      + 'and an AI extraction, so this caps what a run can cost.',
    group: 'Discovery',
    type: 'number',
    fallback: '10',
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
