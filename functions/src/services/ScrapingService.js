import { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import OpenAI from 'openai';
import Source from '../models/Source.js';
import Rate, { labelKey } from '../models/Rate.js';
import Option from '../models/Option.js';
import pLimit from 'p-limit';
import _ from 'lodash';
import Decimal from 'decimal.js';
import { DateTime } from 'luxon';
import { runActor } from '../utils/apify.js';

/**
 * The OpenAI SDK wants a base URL and appends /chat/completions itself, but the
 * URL vars are documented as the full endpoint. Accept either.
 */
function resolveBaseUrl(raw) {
    return raw.replace(/\/+chat\/completions\/?$/, '');
}

/**
 * The OpenAI-compatible endpoints to extract with, in the order to try them:
 * LLM_* is the main one and is required, LLM_BACKUP_* is optional and only
 * used when the main one fails.
 *
 * *_EXTRA_BODY is an optional JSON object merged into that provider's requests,
 * for parameters outside the OpenAI schema — e.g. DeepSeek's
 * {"thinking":{"type":"disabled"}}, without which its reasoning tokens use up
 * max_tokens before any JSON is written.
 */
export function llmProviders() {
    const providers = [];

    for (const [label, prefix] of [['main', 'LLM_'], ['backup', 'LLM_BACKUP_']]) {
        const apiKey = process.env[`${prefix}API_KEY`];
        const apiUrl = process.env[`${prefix}API_URL`];
        const model = process.env[`${prefix}MODEL`];

        if (!apiKey && !apiUrl && !model && label === 'backup') continue;

        if (!apiKey || !apiUrl || !model) {
            throw new Error(`${prefix}API_KEY, ${prefix}API_URL and ${prefix}MODEL must all be set`);
        }

        let extraBody = {};
        const rawExtraBody = process.env[`${prefix}EXTRA_BODY`];
        if (rawExtraBody) {
            try {
                extraBody = JSON.parse(rawExtraBody);
            } catch {
                throw new Error(`${prefix}EXTRA_BODY must be a JSON object`);
            }
            if (!_.isPlainObject(extraBody)) {
                throw new Error(`${prefix}EXTRA_BODY must be a JSON object`);
            }
        }

        providers.push({ label, model, apiKey, baseURL: resolveBaseUrl(apiUrl), extraBody });
    }

    return providers;
}

/**
 * Pages write the local currency as "ZiG" and give its ISO code as ZWG in the
 * same breath. Every measured run answered ZWG, but the prompt is the only thing
 * holding that: one slip would file the same currency under a second code,
 * splitting its history in two and publishing both.
 */
const CURRENCY_ALIASES = { ZIG: 'ZWG' };

export const normaliseCurrency = (code) => CURRENCY_ALIASES[code] ?? code;

/**
 * Page rows are labelled "1 USD to ZiG (Official)" or "1 USD to ZiG cash rate".
 * The model is asked for that label verbatim because paraphrasing it renamed
 * rates between runs, and the name is half of a rate's identity — a reworded
 * label reads as a different rate, so the old one looked delisted. The pair is
 * already carried by `currency`, so the boilerplate is dropped here instead, by
 * rule rather than by judgement, leaving the part that says which rate this is.
 *
 * Best effort on someone else's text: these labels are written by the source
 * site's editors and can be reworded at any time. A label this does not
 * recognise is passed through untouched, and a genuine rewording is matched back
 * to its stored record by Rate.reconcileRenames rather than by this.
 */
export const tidyLabel = (label) => {
    const stripped = label
        .replace(/^\s*1\s+\S+\s+(?:to|in)\s+\S+/i, '')
        .replace(/^[\s–—\-:,]+/, '')
        .trim();
    const unwrapped = /^\(.*\)$/.test(stripped) ? stripped.slice(1, -1).trim() : stripped;
    return unwrapped || label;
};

/**
 * The model re-types the converter tool's answer into its final JSON and rounds
 * it on the way: a computed 17.585089 comes back as 17.585. Stored, that reads
 * as a rate that drifted a thousandth of a percent, and the site then compares a
 * rounded current against a full-precision previous. Where a returned value is
 * exactly one of the computed values rounded to the decimals it carries, the
 * computed value is restored; anything else is the model's own reading of the
 * page and is left alone.
 *
 * The 0.01% guard keeps a coarsely rounded figure from being claimed by a
 * conversion it only happens to match: a page's own "27" must not become a
 * computed 26.5089. Inside the guard the two are the same rate either way.
 */
export const restorePrecision = (rate, computed) => {
    const decimals = new Decimal(rate).decimalPlaces();

    const match = computed.find(value => {
        const candidate = new Decimal(value);
        return candidate.toDecimalPlaces(decimals).eq(rate)
            && candidate.minus(rate).abs().div(rate).lt(1e-4);
    });

    return match ?? rate;
};

/**
 * Whether the page dates a rate older than `maxAgeDays`. The rate's own
 * timestamp wins over the page's date; a rate with neither, or with one that
 * does not parse, is not judged stale — there is nothing to judge it by.
 *
 * Guards against pages nobody maintains any more: FBC's forex page still lists
 * RTGS$ and cross rates dated 28-07-22, which read fine to the model and would
 * otherwise be published as today's.
 */
export const isStale = (rate, maxAgeDays, now = DateTime.now()) => {
    const stamp = rate.updated_at || rate.page_date;
    if (!stamp) return false;

    const date = DateTime.fromISO(stamp);
    return date.isValid && date < now.minus({ days: maxAgeDays });
};

/** The age limit from settings, with a typo falling back to the default. */
async function maxAgeDays() {
    const stored = Number(await Option.getValue('source_max_age_days', 7));
    return Number.isFinite(stored) && stored > 0 ? stored : 7;
}

/**
 * Drop the rates a page dates too old, throwing when that leaves nothing so the
 * source is reported as failing with the date its page gave.
 */
export async function withoutStale(rates, url) {
    const limit = await maxAgeDays();
    const [stale, fresh] = _.partition(rates, rate => isStale(rate, limit));

    if (stale.length > 0 && fresh.length === 0) {
        const dated = stale[0].updated_at || stale[0].page_date;
        throw new Error(`The page dates its rates ${dated}, more than ${limit} days ago, so they were not stored`);
    }

    if (stale.length > 0) {
        logger.warn(`[ScrapingService] ${url}: dropped ${stale.length} rate(s) dated more than ${limit} days ago`);
    }

    return fresh;
}

/**
 * Split out the rates a page gives twice with values that disagree.
 *
 * The same row can reach the model by two routes: CABS lists BWP both in its
 * USD table and, as a cross rate, in its ZiG table, and both come back as
 * "BWP Buy". When the two agree they are one rate; when they do not, at least
 * one is a misreading — the USD table quotes some currencies per USD and others
 * per unit — and nothing on the page says which. Keeping either would publish a
 * coin toss, so every reading of that row is dropped. Agreement is to within 1%,
 * which absorbs the model's rounding.
 *
 * @returns {{kept: Array, conflicts: Array}}
 */
export const dropConflicts = (rates, tolerance = 0.01) => {
    const kept = [];
    const conflicts = [];

    for (const group of Object.values(_.groupBy(rates, r => `${r.currency}::${labelKey(r.name, r.currency)}`))) {
        const values = group.map(r => r.rate);
        const disagree = Math.max(...values) / Math.min(...values) - 1 > tolerance;
        (disagree ? conflicts : kept).push(...group);
    }

    return { kept, conflicts };
};

/**
 * ScrapingService
 *
 * Orchestrates web scraping using Apify (page fetching) and an LLM (rate extraction).
 *
 * Flow for each source:
 *   1. Apify fetches the page (handles JS rendering if needed)
 *   2. The LLM extracts all currency rates from the page content
 *   3. Rate.upsertFromScrape saves/updates the rates in Firestore
 *   4. Source document is updated with last_scraped timestamp and status
 */
export class ScrapingService {

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Scrape all enabled sources with a concurrency limit of 5.
     */
    static async scrapeAll() {
        const sources = await Source.findAll({ enabled: true });
        logger.log(`[ScrapingService] Starting scrape of ${sources.length} sources`);

        const limit = pLimit(5);
        const tasks = sources.map(source =>
            limit(() => ScrapingService.scrapeSource(source))
        );

        const results = await Promise.allSettled(tasks);

        // Pair each result with its source for error logging, then partition by status
        const { fulfilled = [], rejected = [] } = _.groupBy(
            _.zip(results, sources),
            ([r]) => r.status
        );

        rejected.forEach(([result, source]) => {
            logger.error(`[ScrapingService] Source ${source.url} failed:`, result.reason);
        });

        const succeeded = fulfilled.length;
        const failed = rejected.length;

        logger.log(`[ScrapingService] Completed: ${succeeded} succeeded, ${failed} failed`);
        return { succeeded, failed, total: sources.length };
    }

    /**
     * Scrape a single source and upsert results into Firestore.
     * Updates source.status and source.last_scraped on completion.
     *
     * @param {Source} source
     * @returns {Array<{action, currency}>} list of rate upsert results
     */
    static async scrapeSource(source) {
        logger.log(`[ScrapingService] Scraping: ${source.url}`);

        try {
            // Step 1: Fetch page content via Apify
            const content = await ScrapingService.fetchPage(source.url, source.javascript);

            if (!content || content.length < 50) {
                throw new Error('Apify returned empty or insufficient page content');
            }

            // Step 2: Extract rates via the LLM
            const knownLabels = await Rate.knownLabels(source);
            const extracted = await ScrapingService.extractRates(content, source.url, knownLabels);

            if (extracted.length === 0) {
                throw new Error('The LLM could not find any currency rates on this page');
            }

            const { kept, conflicts } = dropConflicts(await withoutStale(extracted, source.url));

            if (kept.length === 0) {
                throw new Error('Every rate on this page was given twice with different values, so none were stored');
            }
            if (conflicts.length > 0) {
                logger.warn(`[ScrapingService] ${source.url}: dropped ${conflicts.length} reading(s) the page contradicts`);
            }

            logger.log(`[ScrapingService] ${source.url}: found ${kept.length} rate(s)`);

            // Step 3: Upsert rates into Firestore
            const results = await Rate.upsertFromScrape(source, kept);
            results.push(...conflicts.map(r => ({ action: 'conflict', currency: r.currency })));

            if (source.probation) {
                results.push(...await ScrapingService.advanceProbation(source, results));
            }

            // Step 4: Update source status
            source.status = true;
            source.status_message = '';
            source.last_scraped = Timestamp.now().toDate();
            await source.save();

            return results;

        } catch (err) {
            logger.error(`[ScrapingService] Error scraping ${source.url}:`, err.message);

            // Update source with failure status. A source on probation has to
            // stay clean for the whole period, and failing to scrape is not clean.
            if (source.probation) source.clean_since = Timestamp.now().toDate();
            source.status = false;
            source.status_message = err.message;
            source.last_scraped = Timestamp.now().toDate();
            await source.save();

            throw err; // Re-throw so scrapeAll() can track failures
        }
    }

    /**
     * Move a source on probation along after a successful scrape: a refused
     * reading restarts its clean run, and a clean run of probation_days promotes
     * it. Promotion takes its rates off probation at once rather than at the
     * next scrape. Mutates `source`; the caller saves it.
     *
     * Rates no other source quotes cannot be refused, so a source quoting only
     * those is promoted on time alone — there is nothing to check it against.
     *
     * @returns {Promise<Array<{action}>>} a 'promoted' result, if it was
     */
    static async advanceProbation(source, results) {
        const now = DateTime.now();

        if (results.some(r => r.action === 'rejected') || !source.clean_since) {
            source.clean_since = now.toJSDate();
            return [];
        }

        const stored = Number(await Option.getValue('probation_days', 7));
        const days = Number.isFinite(stored) && stored > 0 ? stored : 7;

        if (DateTime.fromJSDate(new Date(source.clean_since)) > now.minus({ days })) return [];

        source.probation = false;
        source.clean_since = null;
        await Rate.setProbation(source.id, false);
        logger.log(`[ScrapingService] ${source.url}: promoted after ${days} clean days on probation`);

        return [{ action: 'promoted' }];
    }

    /**
     * Dry run of scrapeSource for a URL that is not saved yet: fetch and extract,
     * but write no rates and touch no source. Lets an admin see within a couple of
     * minutes whether a page will yield rates, instead of after the next hourly run.
     *
     * Also settles the `javascript` flag by trying it: the cheap static fetch first,
     * the browser only if that found nothing. The browser run finding rates where
     * the static one did not is direct evidence the page needs it, which no reading
     * of the static text could give as reliably.
     *
     * @param {string} url
     * @returns {{ok: boolean, javascript: boolean|null, attempts: Array<{javascript, content_length, preview, rates, error}>}}
     */
    static async testSource(url) {
        const attempts = [];

        for (const javascript of [false, true]) {
            const attempt = { javascript, content_length: 0, preview: '', rates: [], conflicts: 0, error: null };
            attempts.push(attempt);

            try {
                const content = await ScrapingService.fetchPage(url, javascript);
                attempt.content_length = content.length;
                attempt.preview = content.substring(0, 1000);

                if (content.length < 50) {
                    throw new Error('The page returned too little text to read rates from');
                }

                attempt.rates = await ScrapingService.extractRates(content, url);

                if (attempt.rates.length === 0) {
                    throw new Error('No currency rates were found on this page');
                }

                const { kept, conflicts } = dropConflicts(await withoutStale(attempt.rates, url));
                attempt.rates = kept;
                attempt.conflicts = conflicts.length;

                if (kept.length === 0) {
                    throw new Error('Every rate on this page was given twice with different values');
                }
            } catch (err) {
                attempt.error = err.message;
                continue;
            }

            break;
        }

        const passed = attempts.find(attempt => !attempt.error);
        return { ok: !!passed, javascript: passed ? passed.javascript : null, attempts };
    }

    // =========================================================================
    // APIFY INTEGRATION
    // =========================================================================

    /**
     * Fetch page content using the Apify website-content-crawler actor.
     *
     * - Uses 'cheerio' crawler for static pages (fast, cheap)
     * - Uses 'playwright:chrome' for JavaScript-heavy pages (slower, more expensive)
     * - Returns the page's markdown (most token-efficient) or falls back to text/html
     *
     * @param {string} url - URL to scrape
     * @param {boolean} requiresJavascript - whether the page needs JS rendering
     * @returns {string} page content
     */
    static async fetchPage(url, requiresJavascript = false) {
        const actorId = process.env.APIFY_ACTOR_ID;
        if (!actorId) {
            throw new Error('APIFY_ACTOR_ID environment variable is not set');
        }

        const items = await runActor(
            actorId,
            { url, javascript: requiresJavascript },
            { timeout: 60, memory: 512 }
        );

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Apify returned no items for this URL');
        }

        const item = items[0];
        // Prefer markdown (token-efficient), fall back to text, then html
        return item.markdown || item.text || item.html || '';
    }

    // =========================================================================
    // LLM INTEGRATION
    // =========================================================================

    /**
     * Extract all currency exchange rates from page content with the main LLM,
     * falling back to the backup LLM if the main one fails.
     *
     * The backup reruns the whole extraction rather than resuming the main one's
     * conversation: tool call ids and message shapes differ between providers.
     *
     * @param {string} content - page content (markdown, text, or HTML)
     * @param {string} url - source URL (context hint for the model)
     * @param {Array<{currency, name}>} knownLabels - labels this page's rates are stored under
     * @returns {Array<{currency, rate, name, updated_at, page_date}>}
     */
    static async extractRates(content, url, knownLabels = []) {
        const failures = [];

        for (const provider of llmProviders()) {
            try {
                return await ScrapingService.extractRatesWith(provider, content, url, knownLabels);
            } catch (err) {
                logger.warn(`[LLM] ${provider.label} (${provider.model}) failed: ${err.message}`);
                failures.push(`${provider.label} LLM (${provider.model}): ${err.message}`);
            }
        }

        throw new Error(failures.join(' | '));
    }

    /**
     * Use one OpenAI-compatible LLM to extract all currency exchange rates from
     * page content.
     *
     * Supports tool calling: when the page expresses rates in ZWG terms (cross-rates),
     * the model calls convert_cross_rate_to_usd to convert them to USD base before
     * returning the final JSON. This avoids the model guessing the conversion.
     *
     * @param {{label, model, apiKey, baseURL, extraBody}} provider - one entry of llmProviders()
     * @param {string} content - page content (markdown, text, or HTML)
     * @param {string} url - source URL (context hint for the model)
     * @param {Array<{currency, name}>} knownLabels - labels this page's rates are stored under
     * @returns {Array<{currency, rate, name, updated_at, page_date}>}
     */
    static async extractRatesWith({ model, apiKey, baseURL, extraBody }, content, url, knownLabels = []) {
        // Bounded so a hung main provider leaves the backup time to run inside
        // the function's 300s timeout; the SDK default is 10 minutes, 2 retries.
        const client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 1 });

        // Read current local currency code from options — configurable without redeployment
        const localCurrency = await Option.getValue('local_currency_code', 'ZWG');

        // Truncate content to manage token costs (~8000 chars ≈ ~2000 tokens)
        const truncatedContent = content.substring(0, 8000);

        // ── Tool definition ───────────────────────────────────────────────────
        // Pure arithmetic — converts a ZWG-based rate to USD base.
        // Two forms match the two ways pages express cross-rates:
        //   "1 EUR = 29.77 ZWG"  → zwg_per_foreign=29.77
        //   "1 ZWG = 0.65 ZAR"   → foreign_per_zwg=0.65
        const tools = [
            {
                type: 'function',
                function: {
                    name: 'convert_cross_rate_to_usd',
                    description:
                        `Convert a ${localCurrency}-based cross-rate to USD base. ` +
                        `Use this whenever you find rates expressed in ${localCurrency} terms ` +
                        `(e.g. "1 EUR = 29.77 ${localCurrency}" or "1 ${localCurrency} = 0.65 ZAR") ` +
                        `and need to express them as how many of that currency you get per 1 USD.`,
                    parameters: {
                        type: 'object',
                        properties: {
                            currency: {
                                type: 'string',
                                description: `3-letter ISO code of the foreign currency (not USD, not ${localCurrency})`
                            },
                            zwg_per_usd: {
                                type: 'number',
                                description: `How many ${localCurrency} per 1 USD — use the official or most representative rate from this page`
                            },
                            zwg_per_foreign: {
                                type: 'number',
                                description: `How many ${localCurrency} per 1 unit of the foreign currency. Provide when rate is stated as "1 [CURRENCY] = X ${localCurrency}"`
                            },
                            foreign_per_zwg: {
                                type: 'number',
                                description: `How many foreign currency per 1 ${localCurrency}. Provide when rate is stated as "1 ${localCurrency} = Y [CURRENCY]"`
                            }
                        },
                        required: ['currency', 'zwg_per_usd']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'invert_rate',
                    description:
                        `Turn an inverse quote ("1 ${localCurrency} = 0.0385 USD") into ${localCurrency} per 1 USD. ` +
                        `Use this rather than dividing yourself, so the result is the same on every run.`,
                    parameters: {
                        type: 'object',
                        properties: {
                            value: {
                                type: 'number',
                                description: `USD per 1 ${localCurrency}, as printed on the page`
                            }
                        },
                        required: ['value']
                    }
                }
            }
        ];

        // ── Prompts ───────────────────────────────────────────────────────────
        const systemPrompt =
            'You are a financial data extractor specialising in Zimbabwean exchange rates. ' +
            'You understand the difference between official RBZ rates, black market/parallel market rates, ' +
            'and retail business rates. ' +
            'When you have finished all tool calls, return ONLY a valid JSON object — no markdown, no explanation.';

        const userPrompt =
`You are extracting currency exchange rates from a Zimbabwean financial/forex website.

Zimbabwe context:
- Current local currency: ${localCurrency} (Zimbabwe Gold / ZiG). ZiG and ${localCurrency} are the same thing.
  Always report it with the ISO code ${localCurrency}. Never "ZiG", "ZIG" or the $ symbol.
- ZWL and ZWD are DEMONETIZED — skip any rate involving them.
- Pages may show: official RBZ rates, interbank rates, black market / parallel market rates, and retail business rates.
- Pages often show rates in TWO ways: USD-based ("1 USD = 26.5 ${localCurrency}") AND ${localCurrency}-based cross-rates ("1 EUR = 29.77 ${localCurrency}").

Goal: return ALL rates expressed as how many units of each currency you get for 1 USD.

Step 1 — identify the USD/${localCurrency} rate on this page (e.g. the official or most representative "1 USD = X ${localCurrency}" figure). You will need it for conversions.
  These are rates in their own right, not just a divisor: return EVERY "1 USD = X ${localCurrency}" figure the page
  shows as its own ${localCurrency} entry — official, interbank, informal/black market, cash, and each named
  business or retail rate. A result with no ${localCurrency} entry at all is wrong whenever the page shows one.

Step 2 — call convert_cross_rate_to_usd for ALL ${localCurrency}-based cross-rates IN A SINGLE RESPONSE
  (include every cross-rate as a separate tool call in the same message — do not call one at a time).
  a. If a rate is already USD-based ("1 USD = X CURRENCY"): record directly, no tool call needed.
  b. If a rate is ${localCurrency}-based ("1 CURRENCY = X ${localCurrency}" or "1 ${localCurrency} = Y CURRENCY"):
     include it as a tool call in the batch.
  c. Skip rates that involve neither USD nor ${localCurrency}.
  d. Skip ZWL, ZWD, and zero/negative rates.
  e. Inverse quotes. A row saying how much USD one ${localCurrency} buys ("1 ${localCurrency} to USD = US$0.0376")
     is a USD/${localCurrency} rate upside down — every entry you return must be units per 1 USD.
     If the page also gives that rate the direct way, skip the inverse: it is not a separate rate.
     If the inverse is the only form the rate appears in (e.g. a bank's ${localCurrency} table with a USD row
     under Buy / Sell columns), call invert_rate on it, in the same batch as the cross-rates, and return its result.

Step 3 — once all conversions are done, return {"page_date": ..., "rates": [...]}.
"page_date": the date the page says its rates are for or were last updated (e.g. "Date : 28-07-22",
  "rates on 6 October 2026") as an ISO 8601 date, or null if the page shows none. Zimbabwean pages write
  numeric dates day first: 06/10/26 is 6 October 2026.
Each element of "rates" has:
- "currency": 3-letter ISO code (USD is never included — it is always the implied base; the local currency is ${localCurrency})
- "rate": how many units of that currency per 1 USD
- "name": the page's own label for that row, copied verbatim and trimmed (Official, Cash Rate, OK Supermarket, etc.).
  Do not paraphrase, expand or re-word it: the same row must produce the same label on every run, because the label
  is part of how a rate is identified between scrapes. Where a rate is one cell of a table, its label is the
  column header that tells it apart from its neighbours (Buy, Sell Cash) — not the table title or the row's
  currency, which "currency" already carries.
- "updated_at": ISO 8601 datetime if visible for that row, else null

Each (currency, name) pair from the same page must be unique.
${knownLabels.length === 0 ? '' : `
Labels this page's rates were stored under on earlier runs:
${knownLabels.map(l => `- ${l.currency}: ${l.name}`).join('\n')}
When a row is one of these, return that label exactly, so it is recognised as the same rate.
`}
Page URL: ${url}

Page content:
${truncatedContent}`;

        // ── Tool call loop ────────────────────────────────────────────────────
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        // Every value the converter tool computed, at full precision, so the
        // rounding the model applies when quoting them back can be undone.
        const computedRates = [];

        const maxRounds = 25; // safety cap — worst case: model calls one tool per round

        for (let round = 0; round < maxRounds; round++) {
            const result = await client.chat.completions.create({
                model,
                messages,
                tools,
                tool_choice: 'auto',
                temperature: 0.1,
                max_tokens: 3000,
                ...extraBody
            });

            // The SDK throws APIError on a non-2xx, so there is no status check
            // here any more — see the catch in scrapeSource.
            const choice = result.choices?.[0];
            if (!choice) throw new Error(`LLM (${model}) returned no choices`);

            const assistantMessage = choice.message;
            const toolCalls = assistantMessage.tool_calls || [];
            messages.push(assistantMessage);

            logger.log(`[LLM] Round ${round + 1}: finish_reason=${choice.finish_reason}, tool_calls=${toolCalls.length}`);

            // Model is done with tool calls — request a clean JSON-only final response
            if (choice.finish_reason !== 'tool_calls' || toolCalls.length === 0) {
                break;
            }

            // Execute each tool call and append results
            const toolResults = toolCalls.map(call => {
                let content;
                try {
                    const args = JSON.parse(call.function.arguments);

                    if (call.function.name === 'convert_cross_rate_to_usd') {
                        const { zwg_per_usd, zwg_per_foreign, foreign_per_zwg } = args;

                        if (!zwg_per_usd || zwg_per_usd <= 0) {
                            content = JSON.stringify({ error: 'zwg_per_usd must be a positive number' });
                        } else if (zwg_per_foreign !== undefined && zwg_per_foreign > 0) {
                            // "1 FOREIGN = zwg_per_foreign ZWG"  →  foreign per USD = zwg_per_usd / zwg_per_foreign
                            const usd_rate = new Decimal(zwg_per_usd).div(zwg_per_foreign).toDecimalPlaces(6).toNumber();
                            computedRates.push(usd_rate);
                            content = JSON.stringify({ usd_rate });
                        } else if (foreign_per_zwg !== undefined && foreign_per_zwg > 0) {
                            // "1 ZWG = foreign_per_zwg FOREIGN"  →  foreign per USD = zwg_per_usd * foreign_per_zwg
                            const usd_rate = new Decimal(zwg_per_usd).times(foreign_per_zwg).toDecimalPlaces(6).toNumber();
                            computedRates.push(usd_rate);
                            content = JSON.stringify({ usd_rate });
                        } else {
                            content = JSON.stringify({ error: 'Provide either zwg_per_foreign or foreign_per_zwg' });
                        }
                    } else if (call.function.name === 'invert_rate') {
                        const { value } = args;

                        if (!value || value <= 0) {
                            content = JSON.stringify({ error: 'value must be a positive number' });
                        } else {
                            const rate = new Decimal(1).div(value).toDecimalPlaces(6).toNumber();
                            computedRates.push(rate);
                            content = JSON.stringify({ rate });
                        }
                    } else {
                        content = JSON.stringify({ error: `Unknown tool: ${call.function.name}` });
                    }
                } catch (e) {
                    content = JSON.stringify({ error: `Tool execution failed: ${e.message}` });
                }

                return { role: 'tool', tool_call_id: call.id, content };
            });

            messages.push(...toolResults);
        }

        // ── Dedicated JSON-only final call ────────────────────────────────────
        // All tool calls are done. Make one clean call with no tools and
        // response_format: json_object so the model is forced to return valid JSON.
        messages.push({ role: 'user', content: 'Return the {"page_date": ..., "rates": [...]} JSON now.' });

        const finalResult = await client.chat.completions.create({
            model,
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 3000,
            ...extraBody
        });

        const finalContent = finalResult.choices?.[0]?.message?.content;

        if (!finalContent) {
            throw new Error(`LLM (${model}) did not return a final JSON response`);
        }

        let parsed;
        try {
            parsed = JSON.parse(finalContent);
        } catch {
            throw new Error(`LLM (${model}) returned invalid JSON: ${finalContent.substring(0, 100)}`);
        }

        const rawRates = Array.isArray(parsed) ? parsed : (parsed.rates || []);
        const pageDate = typeof parsed.page_date === 'string' ? parsed.page_date : null;

        // Demonetized Zimbabwe currencies — always excluded regardless of what the AI returns
        const demonetized = new Set(['ZWL', 'ZWD']);

        return rawRates
            .filter(r =>
                typeof r.currency === 'string' && r.currency.length === 3 &&
                typeof r.rate === 'number' && r.rate > 0 &&
                normaliseCurrency(r.currency.toUpperCase()) !== 'USD' &&
                !demonetized.has(normaliseCurrency(r.currency.toUpperCase()))
            )
            .map(r => ({
                currency: normaliseCurrency(r.currency.toUpperCase()),
                rate: restorePrecision(parseFloat(r.rate), computedRates),
                name: typeof r.name === 'string' && r.name.trim() ? tidyLabel(r.name.trim()) : null,
                updated_at: r.updated_at || null,
                page_date: pageDate
            }));
    }
}
