import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { DateTime } from 'luxon';
import _ from 'lodash';
import Option from './Option.js';
import { getCache, setCache } from '../utils/cache.js';
import Decimal from 'decimal.js';
import { mean, median } from '../utils/decimal.js';

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
 * How far a scraped reading may sit from the consensus of other sources before
 * it is refused, as a factor: 2 accepts anything from half to double it. Wide on
 * purpose — the official and the cash ZWG rate are some 50% apart, and both are
 * real. It is there to catch a misread, not to judge a market.
 */
export const CONSENSUS_TOLERANCE_KEY = 'consensus_tolerance';
const DEFAULT_CONSENSUS_TOLERANCE = 2;

/**
 * A numeric setting, read from the options collection and cached for five
 * minutes the way the currency list is: every rate query needs the freshness
 * window, and an admin's edit should still take effect without a redeploy.
 *
 * A missing, non-numeric or non-positive value falls back to the default. A typo
 * in settings must not unpublish every rate, still less delete one.
 */
async function numberSetting(key, fallback) {
    const cached = await getCache(key);
    if (cached) return cached;

    const stored = Number(await Option.getValue(key, fallback));
    const value = Number.isFinite(stored) && stored > 0 ? stored : fallback;

    await setCache(key, value, DateTime.now().plus({ minutes: 5 }));
    return value;
}

/**
 * Currency words the model mixes into a label at will. On a CABS table titled
 * "Exchange Rates ZiG", row "USD", column "Buy Cash", one row came back over
 * successive runs as "ZiG USD Buy Cash", "USD ZiG Buy Cash", "ZiG Buy Cash",
 * "USD Buy Cash" and "Buy Cash" — five records for one rate. The pair is already
 * carried by the rate's currency, so these words never tell two rates apart.
 */
const CURRENCY_WORDS = ['usd', 'zig', 'zwg'];

/**
 * What a rate is matched on between scrapes: its label without the source
 * prefix, lowercased, stripped of currency words and punctuation, with the words
 * sorted so their order does not matter either. Two labels with the same key
 * are taken to be the same row.
 *
 * A rate stored with no label of its own carries the currency as its name, which
 * this reduces to the same empty key as a scraped rate with no label.
 */
export function labelKey(name, currency) {
    const ignored = new Set([...CURRENCY_WORDS, (currency || '').toLowerCase()]);

    return (name || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(word => word && !ignored.has(word))
        .sort()
        .join(' ');
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
        // Set from its source on every scrape: a source on probation is scraped
        // and stored, but its rates are not served until it is promoted.
        this.probation = data.probation || false;
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
        return DateTime.now().minus({ months: await numberSetting(FRESHNESS_MONTHS_KEY, DEFAULT_FRESHNESS_MONTHS) }).toJSDate();
    }

    /** The `updated_at` past which a rate is deleted rather than merely hidden. */
    static async retentionCutoff() {
        return DateTime.now().minus({ months: await numberSetting(RETENTION_MONTHS_KEY, DEFAULT_RETENTION_MONTHS) }).toJSDate();
    }

    /**
     * The ids of the sources whose rates may be served: every source not
     * switched off. Read here rather than copied onto each rate, so disabling a
     * source takes its rates out of the API without touching them — and they
     * come back as they were, including any switched off one by one, when it is
     * enabled again. Cached for five minutes like the other settings every rate
     * query needs.
     */
    static async servedSourceIds() {
        const cached = await getCache('served_sources');
        if (cached) return new Set(cached);

        const snap = await getFirestore().collection('sources').select('enabled').get();
        const ids = snap.docs.filter(doc => doc.data().enabled !== false).map(doc => doc.id);

        await setCache('served_sources', ids, DateTime.now().plus({ minutes: 5 }));
        return new Set(ids);
    }

    /**
     * Whether a rate's source is one being served. A rate with no source — one
     * added by hand on the Rates page — has nothing to be disabled with. A rate
     * whose source was deleted is not served: deletion now takes the rates with
     * it, but sources deleted before that left theirs behind.
     */
    static fromServedSource(rate, served) {
        return !rate.source_id || served.has(rate.source_id);
    }

    /** The consensus tolerance factor; anything not above 1 would refuse every reading. */
    static async consensusTolerance() {
        const factor = await numberSetting(CONSENSUS_TOLERANCE_KEY, DEFAULT_CONSENSUS_TOLERANCE);
        return factor > 1 ? factor : DEFAULT_CONSENSUS_TOLERANCE;
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

        // Probation is filtered in memory: a where() on it would drop every
        // document written before the field existed.
        const served = await Rate.servedSourceIds();
        rates = rates.filter(rate => !rate.probation && Rate.fromServedSource(rate, served));

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
                    const avgRate = mean(_.map(currencyRates, 'rate')).toNumber();
                    const avgLastRate = mean(_.map(currencyRates, 'last_rate')).toNumber();
                    aggregatedRate = new Rate({
                        ...currencyRates[0],
                        rate: avgRate,
                        last_rate: avgLastRate
                    });
                    break;
                }

                case 'median': {
                    const medianRate = median(_.map(currencyRates, 'rate')).toNumber();
                    const medianLastRate = median(_.map(currencyRates, 'last_rate')).toNumber();

                    aggregatedRate = _.minBy(currencyRates, rate =>
                        new Decimal(rate.rate).minus(medianRate).abs().toNumber());
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
            .select('rate_currency', 'probation', 'source_id')
            .get();
        const served = await Rate.servedSourceIds();

        return _.chain(snapshot.docs)
            .reject(doc => doc.data().probation || !Rate.fromServedSource(doc.data(), served))
            .map(doc => doc.data().rate_currency)
            .compact()
            .map(c => c.toUpperCase())
            .uniq()
            .sort()
            .value();
    }

    /**
     * The consensus for each currency, keyed by code: the median, across the
     * other sources, of each source's own median for it. Only rates the API
     * serves count — so nothing on probation — and never the scraped source's
     * own, which would let a source vouch for itself.
     *
     * A median of medians, so a source quoting a currency twenty ways carries
     * one vote, and a minority of bad sources cannot drag the reference the way
     * a single outlier stretched the min/max band this replaced.
     *
     * @param {string|null} excludeSourceId - the source being scraped
     */
    static async consensus(excludeSourceId = null) {
        const rates = (await Rate.findAll({ enabled: true }))
            .filter(rate => !excludeSourceId || rate.source_id !== excludeSourceId);

        return _.mapValues(_.groupBy(rates, 'rate_currency'), group => {
            const perSource = _.map(
                _.groupBy(group, rate => rate.source_id || rate.source_url),
                own => median(_.map(own, 'rate')).toNumber()
            );
            return median(perSource).toNumber();
        });
    }

    /**
     * Screen a freshly scraped value against the consensus for its currency.
     *
     * Distance is measured as a ratio, so being double the consensus counts the
     * same as being half of it. A value within `tolerance` is accepted, unless
     * its inverse sits even closer to the consensus — a rate quoted the wrong way
     * up, as CABS's USD table does for EUR and GBP (1.0868 USD per EUR, read as
     * 1.0868 EUR per USD). That is only judged past 5% from the consensus: near
     * parity a value and its inverse are both close, and neither is suspicious.
     *
     * A value that fails is retried divided by 100, which catches a figure
     * published in cents; if that fails too the reading is refused rather than
     * published. A currency with nothing to compare against is taken at face
     * value.
     *
     * @returns {number|null} the value to store, or null to refuse it
     */
    static screenRate(value, reference, tolerance = DEFAULT_CONSENSUS_TOLERANCE) {
        if (!reference) return value;

        const distance = (candidate) => Math.abs(Math.log(candidate / reference));
        const plausible = (candidate) => distance(candidate) <= Math.log(tolerance)
            && !(distance(candidate) > Math.log(1.05) && distance(1 / candidate) < distance(candidate));

        if (plausible(value)) return value;

        const corrected = new Decimal(value).div(100).toNumber();
        return plausible(corrected) ? corrected : null;
    }

    /** Mark every rate of a source as on probation or not. */
    static async setProbation(sourceId, probation) {
        const snap = await Rate.getCollection().where('source_id', '==', sourceId).get();
        if (snap.empty) return;

        const batch = getFirestore().batch();
        snap.docs.forEach(doc => batch.update(doc.ref, { probation }));
        await batch.commit();
    }

    /** A stored rate's label without the "<source> - " prefix it was saved under. */
    static ownLabel(source, rateName) {
        const prefix = `${source.name} - `;
        return rateName.startsWith(prefix) ? rateName.slice(prefix.length) : rateName;
    }

    /** The identity a rate is matched on between scrapes — see labelKey. */
    static matchKey(currency, label) {
        return `${currency.toUpperCase()}::${labelKey(label, currency)}`;
    }

    /**
     * Every stored rate of a source with its match key, most recently seen first.
     */
    static async storedFor(source) {
        const snap = await Rate.getCollection()
            .where('source_id', '==', source.id)
            .get();

        const stored = snap.docs.map(doc => {
            const data = doc.data();
            const currency = (data.rate_currency || '').toUpperCase();
            const name = data.rate_name || '';
            const seen = data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at;

            return {
                ref: doc.ref,
                data,
                currency,
                name,
                key: Rate.matchKey(currency, Rate.ownLabel(source, name)),
                seen: seen ? new Date(seen).getTime() : 0
            };
        });

        return _.orderBy(stored, 'seen', 'desc');
    }

    /**
     * The labels a source's rates are stored under, one per rate, for the
     * extraction prompt to reuse. Steering the model back to the label it used
     * before keeps names steady even where matching would cope without it.
     *
     * @returns {Promise<Array<{currency, name}>>}
     */
    static async knownLabels(source) {
        return _.uniqBy(await Rate.storedFor(source), 'key')
            .map(s => ({ currency: s.currency, name: Rate.ownLabel(source, s.name) }));
    }

    /**
     * Relabel stored rates whose name changed on the source page.
     *
     * A rate is identified by (source, currency, label key), but the label is
     * the page's own — written and reworded by the site's editors, with no signal
     * to us that anything changed. A rewording that changes the key reads as one
     * rate disappearing and a different one arriving: the reading loses its
     * history and its last_rate, and both variants are then served side by side
     * until the old one ages out.
     *
     * So where a currency has exactly one stored rate and exactly one scraped
     * rate left over once the keys that do match are paired off, the two are
     * taken to be the same rate under a new label, and the stored record is
     * relabelled so it keeps its history. Anything more ambiguous is left alone:
     * a wrong pairing is worse than a duplicate, and retention now makes a
     * duplicate survivable.
     *
     * Commits separately and re-files each relabelled record in `byKey` under its
     * new key, so the upsert loop finds it there.
     *
     * @param {Map<string, object>} byKey - the source's stored rates by match key
     * @returns {Promise<number>} how many records were relabelled
     */
    static async reconcileRenames(source, scraped, byKey) {
        const batch = getFirestore().batch();
        let renamed = 0;

        for (const [currency, group] of Object.entries(_.groupBy(scraped, r => r.currency.toUpperCase()))) {
            const scrapedKeys = new Set(group.map(r => Rate.matchKey(currency, r.name)));

            const orphans = [...byKey.values()].filter(s => s.currency === currency && !scrapedKeys.has(s.key));
            const arrivals = group.filter(r => !byKey.has(Rate.matchKey(currency, r.name)));

            if (orphans.length === 1 && arrivals.length === 1) {
                const [orphan] = orphans;
                const name = Rate.nameFor(source, arrivals[0]);

                batch.update(orphan.ref, { rate_name: name });
                renamed++;

                byKey.delete(orphan.key);
                byKey.set(Rate.matchKey(currency, arrivals[0].name), { ...orphan, name });
            }
        }

        if (renamed > 0) await batch.commit();
        return renamed;
    }

    /** The name a newly scraped rate is stored under. */
    static nameFor(source, extracted) {
        return extracted.name
            ? `${source.name} - ${extracted.name}`
            : `${source.name} - ${extracted.currency.toUpperCase()}`;
    }

    /**
     * Upsert rates returned by the AI scraper for a given source.
     * For each extracted rate: find the stored one with the same currency and
     * label key (see labelKey), or create a new one.
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

        // Deduplicate by (currency, label key) — last entry wins.
        // Allows multiple variants of the same currency from one source
        // (e.g. Official vs Black Market ZWG) while collapsing the same row
        // returned twice under labels that differ only in currency words.
        // _.keyBy iterates left-to-right and overwrites on collision, so last entry wins.
        const deduped = _.values(
            _.keyBy(extractedRates, r => Rate.matchKey(r.currency, r.name))
        );

        // One stored record per key. Before matching ignored currency words, the
        // model's label drift created a record per wording; the most recently
        // seen one carries on and the rest are deleted, so a source's existing
        // duplicates are merged the next time it is scraped.
        const byKey = new Map();
        const merged = new Set();
        const mergeBatch = db.batch();
        for (const stored of await Rate.storedFor(source)) {
            if (!byKey.has(stored.key)) {
                byKey.set(stored.key, stored);
                continue;
            }
            mergeBatch.delete(stored.ref);
            merged.add(stored.ref.id);
            results.push({ action: 'merged', currency: stored.currency });
        }
        if (merged.size > 0) await mergeBatch.commit();

        // Settle label edits before anything is matched.
        await Rate.reconcileRenames(source, deduped, byKey);

        // Read once per source rather than per rate — every value in this scrape is
        // screened against the same picture of what the API currently serves.
        const [reference, tolerance] = await Promise.all([Rate.consensus(source.id), Rate.consensusTolerance()]);
        const probation = source.probation === true;

        // Process in batches of 499 to respect Firestore limits
        const batchSize = 499;
        for (let i = 0; i < deduped.length; i += batchSize) {
            const batch = db.batch();
            const chunk = deduped.slice(i, i + batchSize);

            for (const extracted of chunk) {
                const currency = extracted.currency.toUpperCase();

                // A reading the consensus refuses is dropped, never written: the stored
                // record keeps the last value we trusted rather than publishing a
                // misread. That leaves its updated_at untouched, so a rate refused
                // scrape after scrape ages out of the API and is eventually swept
                // like any other rate that stopped arriving — which is the right
                // end for a source whose figures have not been trustworthy in a
                // fortnight. It is never deleted for a single refusal.
                const scraped = Rate.screenRate(parseFloat(extracted.rate), reference[currency], tolerance);

                if (scraped === null) {
                    logger.warn(
                        `[Rate] Refused implausible ${currency} rate ${extracted.rate} from ${source.url} ` +
                        `(consensus ${reference[currency]}, tolerance ×${tolerance})`
                    );
                    results.push({ action: 'rejected', currency });
                    continue;
                }

                const existing = byKey.get(Rate.matchKey(currency, extracted.name));

                const rateUpdatedAt = extracted.updated_at
                    ? Timestamp.fromDate(DateTime.fromISO(extracted.updated_at).toJSDate())
                    : now;

                if (!existing) {
                    const newRate = new Rate({
                        rate_name: Rate.nameFor(source, extracted),
                        rate_currency: currency,
                        source_url: source.url,
                        source_id: source.id,
                        rate: scraped,
                        last_rate: scraped, // no previous on first scrape
                        rate_updated_at: rateUpdatedAt.toDate(),
                        enabled: true,
                        probation,
                        created_at: now.toDate(),
                        updated_at: now.toDate()
                    });

                    const docRef = Rate.getCollection().doc();
                    batch.set(docRef, newRate.toFirestore());
                    results.push({ action: 'created', currency });
                } else {
                    const docRef = existing.ref;
                    const oldRate = existing.data.rate || 0;
                    const newRate = scraped;

                    const changes = {
                        rate: newRate,
                        rate_updated_at: rateUpdatedAt,
                        probation,
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
            if (lastSeen && lastSeen < retentionCutoff && !merged.has(doc.ref.id)) {
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
