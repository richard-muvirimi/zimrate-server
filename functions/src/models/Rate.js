import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { DateTime } from 'luxon';
import _ from 'lodash';
import Option from './Option.js';
import { getCache, setCache } from '../utils/cache.js';

/**
 * The middle value, averaging the two middle ones on an even-sized set — what the
 * Laravel `preferred('median')` scope did by feeding an even split back through
 * its MEAN aggregate. Taking the upper-middle value instead skews every even
 * group upward.
 */
function median(values) {
    const sorted = _.sortBy(values);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

/**
 * How long a rate keeps being served after the last scrape that saw it on its
 * source page. `updated_at` records that sighting, so this is the whole of the
 * public API's freshness rule.
 */
export const FRESHNESS_MONTHS_KEY = 'rate_freshness_months';
const DEFAULT_FRESHNESS_MONTHS = 3;

/**
 * How long a rate is kept in Firestore after it stops being seen — far past the
 * point it stopped being served, so a record is only destroyed once it is
 * thoroughly dead. See the sweep at the end of upsertFromScrape.
 */
export const RETENTION_MONTHS_KEY = 'rate_retention_months';
const DEFAULT_RETENTION_MONTHS = 12;

/**
 * A window setting in months, read from the options collection and cached for
 * five minutes the way the currency list is: every rate query needs the
 * freshness window, and an admin's edit should still take effect without a
 * redeploy.
 *
 * A missing, non-numeric or non-positive value falls back to the default. A typo
 * in settings must not unpublish every rate, still less delete one.
 */
async function windowMonths(key, fallback) {
    const cached = await getCache(key);
    if (cached) return cached;

    const stored = Number(await Option.getValue(key, fallback));
    const months = Number.isFinite(stored) && stored > 0 ? stored : fallback;

    await setCache(key, months, DateTime.now().plus({ minutes: 5 }));
    return months;
}

class Rate {
    constructor(data = {}) {
        this.id = data.id || null;
        this.enabled = data.enabled || false;
        this.rate_name = data.rate_name || '';
        this.rate_currency = data.rate_currency || '';
        this.source_url = data.source_url || '';
        this.source_id = data.source_id || null;
        this.rate = data.rate || 0;
        this.last_rate = data.last_rate || 0;
        this.rate_updated_at = data.rate_updated_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;

        // Legacy fields — kept for reading existing Firestore documents, not written on new records
        this.javascript = data.javascript || false;
        this.rate_selector = data.rate_selector || '';
        this.rate_updated_at_selector = data.rate_updated_at_selector || '';
        this.source_timezone = data.source_timezone || 'UTC';
    }

    static getCollection() {
        const db = getFirestore();
        return db.collection('rates');
    }

    /**
     * The `updated_at` a rate must be newer than to still be served. Shared by
     * every read path so one rule decides what the API considers current.
     */
    static async freshnessCutoff() {
        return DateTime.now().minus({ months: await windowMonths(FRESHNESS_MONTHS_KEY, DEFAULT_FRESHNESS_MONTHS) }).toJSDate();
    }

    /** The `updated_at` past which a rate is deleted rather than merely hidden. */
    static async retentionCutoff() {
        return DateTime.now().minus({ months: await windowMonths(RETENTION_MONTHS_KEY, DEFAULT_RETENTION_MONTHS) }).toJSDate();
    }

    // Convert to Firestore format
    toFirestore() {
        const data = { ...this };
        delete data.id;

        const toTimestamp = (val) => {
            if (!val || val instanceof Timestamp) return val;
            if (val instanceof Date) return Timestamp.fromDate(val);
            if (typeof val === 'string') return Timestamp.fromDate(DateTime.fromISO(val).toJSDate());
            return Timestamp.fromMillis(val);
        };

        data.rate_updated_at = toTimestamp(this.rate_updated_at);
        data.created_at = toTimestamp(this.created_at);
        data.updated_at = toTimestamp(this.updated_at);

        return data;
    }

    // Convert from Firestore format
    static fromFirestore(doc) {
        const data = doc.data();

        const toDate = (val) => (val && val.toDate) ? val.toDate() : val;

        data.rate_updated_at = toDate(data.rate_updated_at);
        data.created_at = toDate(data.created_at);
        data.updated_at = toDate(data.updated_at);

        return new Rate({ id: doc.id, ...data });
    }

    // API representation
    //
    // The GraphQL schema declares currency, last_checked, last_updated, rate and
    // last_rate non-null — as the Laravel backend's columns were — so none of them
    // may be null here: a null under a non-null field blanks out the whole rate
    // list. Timestamps fall back to the record's other timestamps, and last_rate
    // falls back to the current rate, which is what a first scrape stores when
    // there is no previous reading; it leaves deltas at zero rather than dividing
    // by nothing.
    toAPI() {
        // An Invalid Date (the legacy MySQL import can produce one from an
        // unparseable timestamp) yields NaN, which Int! refuses to serialise —
        // and a refusal here takes the whole rate list down, not just one field.
        const toUnix = (date) => {
            const seconds = date ? DateTime.fromJSDate(date).toUnixInteger() : 0;
            return Number.isFinite(seconds) ? seconds : 0;
        };

        return {
            currency: this.rate_currency,
            name: this.rate_name,
            last_checked: toUnix(this.updated_at || this.rate_updated_at || this.created_at),
            last_updated: toUnix(this.rate_updated_at || this.updated_at || this.created_at),
            rate: this.rate,
            last_rate: this.last_rate || this.rate,
            url: this.source_url,
        };
    }

    // Save to Firestore
    async save() {
        const collection = Rate.getCollection();
        const data = this.toFirestore();

        if (this.id) {
            await collection.doc(this.id).update({
                ...data,
                updated_at: Timestamp.now()
            });
        } else {
            const now = Timestamp.now();
            data.created_at = now;
            data.updated_at = now;

            const docRef = await collection.add(data);
            this.id = docRef.id;
        }

        return this;
    }

    // Static methods for querying
    static async findAll(filters = {}) {
        const queries = [];

        // Build base filters
        const baseFilters = {};
        if (filters.enabled !== undefined) {
            baseFilters.enabled = filters.enabled;
        }

        if (filters.currency) {
            baseFilters.rate_currency = filters.currency.toUpperCase();
        }

        if (filters.dateAfter) {
            const date = DateTime.fromSeconds(filters.dateAfter).toJSDate();
            baseFilters.dateAfter = Timestamp.fromDate(date);
        }

        // The "updated" scope keeps stale rates out of the public API.
        //
        // This used to be a union of two queries: `status == true` OR recently
        // updated. Because every scraped rate was written with status = true and
        // nothing ever set it to false, the first query matched the entire
        // collection and the time window never excluded anything. With the status
        // field gone, the window is the whole scope.
        let query = Rate.getCollection();
        Object.entries(baseFilters).forEach(([key, value]) => {
            if (key === 'dateAfter') {
                query = query.where('rate_updated_at', '>', value);
            } else {
                query = query.where(key, '==', value);
            }
        });

        if (filters.applyUpdatedScope !== false) { // default to true unless explicitly disabled
            query = query.where('updated_at', '>', Timestamp.fromDate(await Rate.freshnessCutoff()));
        }

        queries.push(query);

        // Execute all queries and combine results
        const allRates = new Map(); // Use Map to deduplicate by ID

        for (const query of queries) {
            let finalQuery = query.orderBy('updated_at', 'desc');
            if (filters.limit) {
                finalQuery = finalQuery.limit(filters.limit);
            }

            const snapshot = await finalQuery.get();
            snapshot.docs.forEach(doc => {
                if (!allRates.has(doc.id)) {
                    allRates.set(doc.id, Rate.fromFirestore(doc));
                }
            });
        }

        let rates = Array.from(allRates.values());

        // Apply search filter in memory (Firestore limitation)
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            rates = rates.filter(rate =>
                rate.rate_name.toLowerCase().includes(searchTerm)
            );
        }

        // Sort results by updated_at desc
        rates.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

        return rates;
    }

    // Apply aggregation logic
    static async getAggregatedRates(prefer, filters = {}) {
        const rates = await Rate.findAll(filters);

        if (!prefer) {
            return rates;
        }

        // Group by currency using lodash
        const grouped = _.groupBy(rates, 'rate_currency');
        const result = [];

        for (const [, currencyRates] of Object.entries(grouped)) {
            let aggregatedRate;

            switch (prefer.toLowerCase()) {
                case 'max':
                    aggregatedRate = _.maxBy(currencyRates, 'rate');
                    break;

                case 'min':
                    aggregatedRate = _.minBy(currencyRates, 'rate');
                    break;

                case 'mean': {
                    const avgRate = _.meanBy(currencyRates, 'rate');
                    const avgLastRate = _.meanBy(currencyRates, 'last_rate');
                    aggregatedRate = new Rate({
                        ...currencyRates[0],
                        rate: avgRate,
                        last_rate: avgLastRate
                    });
                    break;
                }

                case 'median': {
                    const medianRate = median(_.map(currencyRates, 'rate'));
                    const medianLastRate = median(_.map(currencyRates, 'last_rate'));

                    aggregatedRate = _.minBy(currencyRates, rate => Math.abs(rate.rate - medianRate));
                    aggregatedRate = new Rate({
                        ...aggregatedRate,
                        rate: medianRate,
                        last_rate: medianLastRate
                    });
                    break;
                }

                case 'random':
                    aggregatedRate = _.sample(currencyRates);
                    break;

                case 'mode': {
                    const rateGroups = _.groupBy(currencyRates, rate => rate.rate.toString());
                    const mostCommonRateGroup = _.maxBy(Object.values(rateGroups), group => group.length);
                    aggregatedRate = _.head(mostCommonRateGroup);
                    break;
                }

                default:
                    aggregatedRate = _.head(currencyRates);
            }

            result.push(aggregatedRate);
        }

        return result;
    }

    // Get unique currencies from the database.
    // Matches the "updated" scope in findAll — see the note there on why the
    // former `status == true` half of this union was doing nothing.
    static async getUniqueCurrencies() {
        const snapshot = await Rate.getCollection()
            .where('enabled', '==', true)
            .where('updated_at', '>', Timestamp.fromDate(await Rate.freshnessCutoff()))
            .select('rate_currency')
            .get();

        return _.chain(snapshot.docs)
            .map(doc => doc.data().rate_currency)
            .compact()
            .map(c => c.toUpperCase())
            .uniq()
            .sort()
            .value();
    }

    /**
     * The plausible range of each currency, keyed by code: the lowest and highest
     * rate the API is currently serving for it.
     *
     * findAll's default freshness window is the same "enabled and updated" set the
     * Laravel scraper measured a fresh reading against.
     */
    static async currencyBands() {
        const rates = await Rate.findAll({ enabled: true });

        return _.mapValues(
            _.groupBy(rates, 'rate_currency'),
            group => ({ min: _.minBy(group, 'rate').rate, max: _.maxBy(group, 'rate').rate })
        );
    }

    /**
     * Screen a freshly scraped value against what is already being served for that
     * currency, as the Laravel scraper's cleanRate did.
     *
     * Outside 0.7×min … 1.3×max the value is retried divided by 100, which catches
     * a figure published in cents; if that still misses the band the reading is
     * refused rather than published. A currency with nothing to compare against is
     * taken at face value.
     *
     * @returns {number|null} the value to store, or null to refuse it
     */
    static screenRate(value, band) {
        if (!band || !band.min || !band.max) return value;

        const inBand = (candidate) => candidate >= band.min * 0.7 && candidate <= band.max * 1.3;

        if (inBand(value)) return value;

        const corrected = value / 100;
        return inBand(corrected) ? corrected : null;
    }

    /**
     * Relabel stored rates whose name changed on the source page.
     *
     * A rate is identified by (source, currency, name), but that name is the
     * page's own label — written and reworded by the site's editors, with no
     * signal to us that anything changed. Matched on the name alone, a reworded
     * row reads as one rate disappearing and a different one arriving: the
     * reading loses its history and its last_rate, and both variants are then
     * served side by side until the old one ages out.
     *
     * So where a currency has exactly one stored rate and exactly one scraped
     * rate left over once the names that do match are paired off, the two are
     * taken to be the same rate under a new label, and the stored record is
     * relabelled so it keeps its history. Anything more ambiguous is left alone:
     * a wrong pairing is worse than a duplicate, and retention now makes a
     * duplicate survivable.
     *
     * Runs before the upsert loop and commits separately, so the loop's lookup by
     * name finds the record under its new label.
     *
     * @returns {Promise<number>} how many records were relabelled
     */
    static async reconcileRenames(source, scraped) {
        const nameFor = (r) => r.name
            ? `${source.name} - ${r.name}`
            : `${source.name} - ${r.currency.toUpperCase()}`;

        const storedSnap = await Rate.getCollection()
            .where('source_id', '==', source.id)
            .get();

        const stored = storedSnap.docs.map(doc => ({
            ref: doc.ref,
            currency: (doc.data().rate_currency || '').toUpperCase(),
            name: doc.data().rate_name || ''
        }));

        const wanted = scraped.map(r => ({ currency: r.currency.toUpperCase(), name: nameFor(r) }));

        const batch = getFirestore().batch();
        let renamed = 0;

        for (const [currency, group] of Object.entries(_.groupBy(wanted, 'currency'))) {
            const storedHere = stored.filter(s => s.currency === currency);
            const scrapedNames = new Set(group.map(g => g.name));
            const storedNames = new Set(storedHere.map(s => s.name));

            const orphans = storedHere.filter(s => !scrapedNames.has(s.name));
            const arrivals = group.filter(g => !storedNames.has(g.name));

            if (orphans.length === 1 && arrivals.length === 1) {
                batch.update(orphans[0].ref, { rate_name: arrivals[0].name });
                renamed++;
            }
        }

        if (renamed > 0) await batch.commit();
        return renamed;
    }

    /**
     * Upsert rates returned by the AI scraper for a given source.
     * For each extracted rate: find existing (source_id + rate_currency) or create new.
     * Saves the new rate value, shifting the current rate → last_rate only when the
     * two differ, so last_rate stays the previous *different* reading.
     *
     * @param {Source} source - The source document
     * @param {Array<{currency, rate, name, updated_at}>} extractedRates
     * @returns {Array<{action, currency}>}
     */
    static async upsertFromScrape(source, extractedRates) {
        const db = getFirestore();
        const now = Timestamp.now();
        const results = [];

        // Deduplicate by (currency, name) — last entry wins.
        // Allows multiple variants of the same currency from one source
        // (e.g. Official vs Black Market ZWG) while preventing the batch-write
        // bug where identical pairs pass the "find existing" check before commit.
        // _.keyBy iterates left-to-right and overwrites on collision, so last entry wins.
        const deduped = _.values(
            _.keyBy(extractedRates, r => `${r.currency.toUpperCase()}::${(r.name || '').toLowerCase()}`)
        );

        // Settle label edits before anything is matched by name.
        await Rate.reconcileRenames(source, deduped);

        // Read once per source rather than per rate — every value in this scrape is
        // screened against the same picture of what the API currently serves.
        const bands = await Rate.currencyBands();

        // Process in batches of 499 to respect Firestore limits
        const batchSize = 499;
        for (let i = 0; i < deduped.length; i += batchSize) {
            const batch = db.batch();
            const chunk = deduped.slice(i, i + batchSize);

            for (const extracted of chunk) {
                const currency = extracted.currency.toUpperCase();
                const rateName = extracted.name
                    ? `${source.name} - ${extracted.name}`
                    : `${source.name} - ${currency}`;

                // A reading the band refuses is dropped, never written: the stored
                // record keeps the last value we trusted rather than publishing a
                // misread. That leaves its updated_at untouched, so a rate refused
                // scrape after scrape ages out of the API and is eventually swept
                // like any other rate that stopped arriving — which is the right
                // end for a source whose figures have not been trustworthy in a
                // fortnight. It is never deleted for a single refusal.
                const scraped = Rate.screenRate(parseFloat(extracted.rate), bands[currency]);

                if (scraped === null) {
                    logger.warn(
                        `[Rate] Refused implausible ${currency} rate ${extracted.rate} from ${source.url} ` +
                        `(band ${bands[currency].min}–${bands[currency].max})`
                    );
                    results.push({ action: 'rejected', currency });
                    continue;
                }

                // Find existing rate for this source + currency + name
                const existing = await Rate.getCollection()
                    .where('source_id', '==', source.id)
                    .where('rate_currency', '==', currency)
                    .where('rate_name', '==', rateName)
                    .limit(1)
                    .get();

                const rateUpdatedAt = extracted.updated_at
                    ? Timestamp.fromDate(DateTime.fromISO(extracted.updated_at).toJSDate())
                    : now;

                if (existing.empty) {
                    const newRate = new Rate({
                        rate_name: rateName,
                        rate_currency: currency,
                        source_url: source.url,
                        source_id: source.id,
                        rate: scraped,
                        last_rate: scraped, // no previous on first scrape
                        rate_updated_at: rateUpdatedAt.toDate(),
                        enabled: true,
                        created_at: now.toDate(),
                        updated_at: now.toDate()
                    });

                    const docRef = Rate.getCollection().doc();
                    batch.set(docRef, newRate.toFirestore());
                    results.push({ action: 'created', currency });
                } else {
                    const docRef = existing.docs[0].ref;
                    const oldRate = existing.docs[0].data().rate || 0;
                    const newRate = scraped;

                    const changes = {
                        rate: newRate,
                        rate_updated_at: rateUpdatedAt,
                        updated_at: now
                    };

                    // last_rate holds the previous *different* reading, as it did in the
                    // Laravel scraper. Shifting on every scrape would overwrite the real
                    // previous value with the current one on the next hourly run, so a
                    // rate that holds steady for a day — most of them, most days — would
                    // show a zero delta instead of its last actual move.
                    if (newRate !== oldRate) {
                        changes.last_rate = oldRate;
                    }

                    batch.update(docRef, changes);
                    results.push({ action: 'updated', currency });
                }
            }

            await batch.commit();
        }

        // Remove this source's rates only once they have gone a full
        // RETENTION_WINDOW without being seen.
        //
        // Absence from a single scrape means nothing: a truncated page, a failed
        // fetch or an extraction that missed a row all look exactly like a
        // delisting, and deleting on that evidence destroyed the record — last_rate
        // with it, so a currency that came back reappeared with no change history
        // and no band to screen the next reading against. Consumers saw currencies
        // blink in and out hourly, and last_updated could not warn them because
        // there was no longer a record to carry it.
        //
        // A rate that stops updating leaves the API on its own once it falls
        // outside the freshness window; this sweep only reclaims the storage,
        // much later. Both windows are settings, so the later of the two cutoffs
        // is never used: a retention window mistakenly set shorter than the
        // serving one would otherwise delete rates still being served.
        const [retention, freshness] = await Promise.all([Rate.retentionCutoff(), Rate.freshnessCutoff()]);
        const retentionCutoff = retention < freshness ? retention : freshness;

        const allSourceRates = await Rate.getCollection()
            .where('source_id', '==', source.id)
            .get();

        const deleteBatch = db.batch();
        let deleteCount = 0;
        allSourceRates.docs.forEach(doc => {
            const data = doc.data();
            // Filtered here rather than in the query: it keeps this a single-field
            // read needing no composite index, and a source's rates number in the
            // tens. A record with no updated_at at all (the legacy MySQL import
            // could produce one) is kept — it is already invisible to every read
            // path, and guessing an age for it would only risk deleting real data.
            const lastSeen = data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at;
            if (lastSeen && lastSeen < retentionCutoff) {
                deleteBatch.delete(doc.ref);
                deleteCount++;
                results.push({ action: 'deleted', currency: data.rate_currency });
            }
        });

        if (deleteCount > 0) {
            await deleteBatch.commit();
        }

        return results;
    }
}

export default Rate;
