import { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import OpenAI from 'openai';
import Source from '../models/Source.js';
import Rate from '../models/Rate.js';
import Option from '../models/Option.js';
import pLimit from 'p-limit';
import _ from 'lodash';

const DEFAULT_LLM_BASE_URL = 'https://api.deepseek.com';

/**
 * The OpenAI SDK wants a base URL and appends /chat/completions itself, but
 * DEEPSEEK_API_URL has always been documented as the full endpoint. Accept
 * either so existing deployments keep working after the switch off raw fetch.
 */
function resolveBaseUrl() {
    const raw = process.env.DEEPSEEK_API_URL;
    if (!raw) return DEFAULT_LLM_BASE_URL;
    return raw.replace(/\/+chat\/completions\/?$/, '');
}

/**
 * ScrapingService
 *
 * Orchestrates web scraping using Apify (page fetching) and DeepSeek AI (rate extraction).
 *
 * Flow for each source:
 *   1. Apify fetches the page (handles JS rendering if needed)
 *   2. DeepSeek extracts all currency rates from the page content
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

            // Step 2: Extract rates via DeepSeek AI
            const extractedRates = await ScrapingService.extractRates(content, source.url);

            if (extractedRates.length === 0) {
                throw new Error('DeepSeek could not find any currency rates on this page');
            }

            logger.log(`[ScrapingService] ${source.url}: found ${extractedRates.length} rate(s)`);

            // Step 3: Upsert rates into Firestore
            const results = await Rate.upsertFromScrape(source, extractedRates);

            // Step 4: Update source status
            source.status = true;
            source.status_message = '';
            source.last_scraped = Timestamp.now().toDate();
            await source.save();

            return results;

        } catch (err) {
            logger.error(`[ScrapingService] Error scraping ${source.url}:`, err.message);

            // Update source with failure status
            source.status = false;
            source.status_message = err.message;
            source.last_scraped = Timestamp.now().toDate();
            await source.save();

            throw err; // Re-throw so scrapeAll() can track failures
        }
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
        const apifyToken = process.env.APIFY_TOKEN;
        if (!apifyToken) {
            throw new Error('APIFY_TOKEN environment variable is not set');
        }

        const actorId = process.env.APIFY_ACTOR_ID;
        if (!actorId) {
            throw new Error('APIFY_ACTOR_ID environment variable is not set');
        }

        const apiUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items` +
            `?token=${apifyToken}&timeout=60&memory=512`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                javascript: requiresJavascript
            })
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Apify API error ${response.status}: ${body.substring(0, 200)}`);
        }

        const items = await response.json();

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Apify returned no items for this URL');
        }

        const item = items[0];
        // Prefer markdown (token-efficient), fall back to text, then html
        return item.markdown || item.text || item.html || '';
    }

    // =========================================================================
    // DEEPSEEK AI INTEGRATION
    // =========================================================================

    /**
     * Use DeepSeek AI to extract all currency exchange rates from page content.
     *
     * Supports tool calling: when the page expresses rates in ZWG terms (cross-rates),
     * DeepSeek calls convert_cross_rate_to_usd to convert them to USD base before
     * returning the final JSON. This avoids the model guessing the conversion.
     *
     * Compatible with any OpenAI-format API (swap DEEPSEEK_API_URL to change provider).
     *
     * @param {string} content - page content (markdown, text, or HTML)
     * @param {string} url - source URL (context hint for the model)
     * @returns {Array<{currency, rate, name, updated_at}>}
     */
    static async extractRates(content, url) {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error('DEEPSEEK_API_KEY environment variable is not set');
        }

        const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
        const client = new OpenAI({ apiKey, baseURL: resolveBaseUrl() });

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
- ZWL and ZWD are DEMONETIZED — skip any rate involving them.
- Pages may show: official RBZ rates, interbank rates, black market / parallel market rates, and retail business rates.
- Pages often show rates in TWO ways: USD-based ("1 USD = 26.5 ${localCurrency}") AND ${localCurrency}-based cross-rates ("1 EUR = 29.77 ${localCurrency}").

Goal: return ALL rates expressed as how many units of each currency you get for 1 USD.

Step 1 — identify the USD/${localCurrency} rate on this page (e.g. the official or most representative "1 USD = X ${localCurrency}" figure). You will need it for conversions.

Step 2 — call convert_cross_rate_to_usd for ALL ${localCurrency}-based cross-rates IN A SINGLE RESPONSE
  (include every cross-rate as a separate tool call in the same message — do not call one at a time).
  a. If a rate is already USD-based ("1 USD = X CURRENCY"): record directly, no tool call needed.
  b. If a rate is ${localCurrency}-based ("1 CURRENCY = X ${localCurrency}" or "1 ${localCurrency} = Y CURRENCY"):
     include it as a tool call in the batch.
  c. Skip rates that involve neither USD nor ${localCurrency}.
  d. Skip ZWL, ZWD, and zero/negative rates.

Step 3 — once all conversions are done, return {"rates": [...]} where each element has:
- "currency": 3-letter ISO code (USD is never included — it is always the implied base)
- "rate": how many units of that currency per 1 USD
- "name": descriptive label (Official, Interbank, Black Market, Black Market (Harare), OK Supermarket, Cash Rate, etc.)
- "updated_at": ISO 8601 datetime if visible, else null

Each (currency, name) pair from the same page must be unique.

Page URL: ${url}

Page content:
${truncatedContent}`;

        // ── Tool call loop ────────────────────────────────────────────────────
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        const maxRounds = 25; // safety cap — worst case: model calls one tool per round

        for (let round = 0; round < maxRounds; round++) {
            const result = await client.chat.completions.create({
                model,
                messages,
                tools,
                tool_choice: 'auto',
                temperature: 0.1,
                max_tokens: 3000
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
                            const usd_rate = zwg_per_usd / zwg_per_foreign;
                            content = JSON.stringify({ usd_rate: parseFloat(usd_rate.toFixed(6)) });
                        } else if (foreign_per_zwg !== undefined && foreign_per_zwg > 0) {
                            // "1 ZWG = foreign_per_zwg FOREIGN"  →  foreign per USD = zwg_per_usd * foreign_per_zwg
                            const usd_rate = zwg_per_usd * foreign_per_zwg;
                            content = JSON.stringify({ usd_rate: parseFloat(usd_rate.toFixed(6)) });
                        } else {
                            content = JSON.stringify({ error: 'Provide either zwg_per_foreign or foreign_per_zwg' });
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
        // response_format: json_object so DeepSeek is forced to return valid JSON.
        messages.push({ role: 'user', content: 'Return the {"rates": [...]} JSON now.' });

        const finalResult = await client.chat.completions.create({
            model,
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 3000
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

        // Demonetized Zimbabwe currencies — always excluded regardless of what the AI returns
        const demonetized = new Set(['ZWL', 'ZWD']);

        return rawRates
            .filter(r =>
                typeof r.currency === 'string' && r.currency.length === 3 &&
                typeof r.rate === 'number' && r.rate > 0 &&
                r.currency.toUpperCase() !== 'USD' &&
                !demonetized.has(r.currency.toUpperCase())
            )
            .map(r => ({
                currency: r.currency.toUpperCase(),
                rate: parseFloat(r.rate),
                name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : null,
                updated_at: r.updated_at || null
            }));
    }
}
