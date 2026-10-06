import { createHash } from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import _ from 'lodash';
import Option from '../models/Option.js';
import Source from '../models/Source.js';
import Rate from '../models/Rate.js';
import { ScrapingService } from './ScrapingService.js';
import { runActor } from '../utils/apify.js';

const DEFAULT_QUERIES = [
    'ZiG exchange rate today',
    'ZWG USD exchange rate',
    'Zimbabwe bank exchange rates ZiG',
    'Zimbabwe parallel market rate ZiG',
    'RBZ interbank rate ZWG',
];

/**
 * Sites that come up for these searches and never publish a ZWG rate worth
 * scraping. The crypto exchanges matter most: a token called ZIG trades on
 * them, and its price reads to the model as ZiG — searching Google News for
 * "ZiG exchange rate" returned five Bybit pages out of six.
 */
const DEFAULT_BLOCKED_DOMAINS = [
    'bybit.com', 'binance.com', 'coinmarketcap.com', 'coingecko.com', 'kucoin.com', 'okx.com',
    'mexc.com', 'gate.io', 'coinbase.com', 'google.com', 'youtube.com', 'facebook.com',
    'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'linkedin.com', 'reddit.com', 'wikipedia.org',
];

/** Query-string noise added by Google and trackers; never part of a page's identity. */
const TRACKING_PARAMS = /^(utm_|srsltid$|gclid$|fbclid$|ved$|usg$)/;

const lines = (text) => String(text ?? '').split('\n').map(line => line.trim()).filter(Boolean);

async function numberOption(key, fallback) {
    const stored = Number(await Option.getValue(key, fallback));
    return Number.isFinite(stored) && stored > 0 ? stored : fallback;
}

/**
 * A URL with its fragment and tracking parameters removed — the address a
 * candidate is stored and fetched under.
 *
 * @returns {string|null} null for anything that is not an http(s) URL
 */
export function cleanUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    url.hash = '';
    for (const name of [...url.searchParams.keys()]) {
        if (TRACKING_PARAMS.test(name)) url.searchParams.delete(name);
    }
    return url.toString();
}

/**
 * What two URLs are compared on: host without "www.", path without a trailing
 * slash, and the cleaned query string. The zimpricecheck source was added with
 * Google's srsltid still on it; it must still be recognised as already known.
 */
export function urlKey(raw) {
    const clean = cleanUrl(raw);
    if (!clean) return null;

    const url = new URL(clean);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}${url.search}`;
}

/** Whether the URL's host is a blocked domain or a subdomain of one. */
export function isBlocked(raw, blocked) {
    const host = new URL(raw).hostname.toLowerCase();
    return blocked.some(domain => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Finds candidate sources with a Google search and vets them, for an admin to
 * approve. Nothing found here is ever scraped into the API on its own: an
 * approved candidate becomes a source on probation, and only a clean run of
 * probation_days puts its rates in front of consumers.
 */
export class DiscoveryService {

    static getCollection() {
        return getFirestore().collection('source_candidates');
    }

    /**
     * Search, filter out what is blocked or already known, and file up to
     * discovery_max_candidates new candidates. Each new candidate starts its
     * own vetting run through the zimrate_candidate_test trigger.
     *
     * @returns {Promise<{results: number, added: number}>}
     */
    static async discover() {
        const [rawQueries, rawBlocked, maxCandidates] = await Promise.all([
            Option.getValue('discovery_queries', DEFAULT_QUERIES.join('\n')),
            Option.getValue('discovery_blocked_domains', DEFAULT_BLOCKED_DOMAINS.join('\n')),
            numberOption('discovery_max_candidates', 10),
        ]);
        const queries = lines(rawQueries);
        const blocked = lines(rawBlocked).map(domain => domain.toLowerCase());

        if (queries.length === 0) throw new Error('No discovery queries are set');

        const results = await DiscoveryService.search(queries);

        // Rejected candidates stay in the collection, so a site turned down once
        // is never proposed again. Sources are read whole rather than through
        // Source.findAll, whose orderBy drops any document missing updated_at.
        const [sources, candidates] = await Promise.all([
            Source.getCollection().select('url').get(),
            DiscoveryService.getCollection().select('url').get(),
        ]);
        const known = new Set(
            [...sources.docs, ...candidates.docs].map(doc => urlKey(doc.data().url || ''))
        );

        const fresh = _.uniqBy(
            results.filter(result => {
                const url = cleanUrl(result.url);
                return url && !isBlocked(url, blocked) && !known.has(urlKey(url));
            }),
            result => urlKey(result.url)
        ).slice(0, maxCandidates);

        // The id is derived from the URL, so two runs racing cannot file the
        // same page twice: the second create fails and is skipped.
        let added = 0;
        for (const result of fresh) {
            const url = cleanUrl(result.url);
            const id = createHash('sha1').update(urlKey(url)).digest('hex');
            try {
                await DiscoveryService.getCollection().doc(id).create({
                    url,
                    domain: new URL(url).hostname.replace(/^www\./, ''),
                    title: result.title || '',
                    description: result.description || '',
                    query: result.query || '',
                    status: 'new',
                    found_at: FieldValue.serverTimestamp(),
                });
                added++;
            } catch (err) {
                if (err.code !== 6) throw err; // 6 = ALREADY_EXISTS
            }
        }

        logger.log(`[Discovery] ${results.length} search result(s), ${added} new candidate(s)`);
        return { results: results.length, added };
    }

    /**
     * Run the queries through the Apify Google Search actor.
     *
     * @returns {Promise<Array<{url, title, description, query}>>} organic results
     */
    static async search(queries) {
        // Allowed 150s, not the 240s it had: waiting for a free run slot can
        // take up to two minutes of the trigger's 300 before this even starts.
        const pages = await runActor(
            process.env.APIFY_SEARCH_ACTOR_ID || 'apify~google-search-scraper',
            {
                queries: queries.join('\n'),
                countryCode: 'zw',
                maxPagesPerQuery: 1,
                mobileResults: false,
            },
            { timeout: 150, memory: 1024 }
        );
        if (!Array.isArray(pages)) throw new Error('Apify search returned an unexpected response');

        return pages.flatMap(page => (page.organicResults || []).map(result => ({
            url: result.url,
            title: result.title,
            description: result.description,
            query: page.searchQuery?.term,
        })));
    }

    /**
     * Vet a candidate: the same dry run as Test source, held to a stricter
     * standard because nobody chose this page.
     *
     * - It must show a date. A manual source with no date is the admin's call;
     *   an unknown page with no date cannot be told apart from an abandoned one.
     * - Its rates are screened against the consensus of the trusted sources,
     *   and a page none of whose rates survive that is failed outright.
     *
     * @returns {Promise<object>} the fields to write onto the candidate
     */
    static async vet(url) {
        const test = await ScrapingService.testSource(url);
        const attempt = test.ok ? test.attempts.find(a => !a.error) : null;

        if (!attempt) {
            return {
                status: 'failed',
                error: test.attempts.map(a => a.error).filter(Boolean).join(' | ') || 'No rates found',
                javascript: null,
                rates: [],
            };
        }

        const [reference, tolerance] = await Promise.all([Rate.consensus(), Rate.consensusTolerance()]);
        const rates = attempt.rates.map(r => ({
            currency: r.currency,
            name: r.name,
            rate: r.rate,
            refused: Rate.screenRate(r.rate, reference[r.currency], tolerance) === null,
        }));
        const pageDate = attempt.rates.find(r => r.page_date || r.updated_at);
        const verdict = { javascript: test.javascript, rates, page_date: pageDate?.page_date || pageDate?.updated_at || null };

        if (!verdict.page_date) {
            return { ...verdict, status: 'failed', error: 'The page shows no date, so there is no telling whether it is kept up to date' };
        }
        if (rates.every(r => r.refused)) {
            return { ...verdict, status: 'failed', error: 'None of its rates agree with the trusted sources' };
        }
        return { ...verdict, status: 'passed', error: null };
    }
}
