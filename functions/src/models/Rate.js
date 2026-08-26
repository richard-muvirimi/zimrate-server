import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';
import _ from 'lodash';

class Rate {
    constructor(data = {}) {
        this.id = data.id || null;
        this.status = data.status || false;
        this.enabled = data.enabled || false;
        this.rate_name = data.rate_name || '';
        this.rate_currency = data.rate_currency || '';
        this.source_url = data.source_url || '';
        this.source_id = data.source_id || null;
        this.rate = data.rate || 0;
        this.last_rate = data.last_rate || 0;
        this.rate_updated_at = data.rate_updated_at || null;
        this.status_message = data.status_message || '';
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;

        // Legacy fields — kept for reading existing Firestore documents, not written on new records
        this.javascript = data.javascript || false;
        this.rate_selector = data.rate_selector || '';
        this.rate_updated_at_selector = data.rate_updated_at_selector || '';
        this.transform = data.transform || '';
        this.source_timezone = data.source_timezone || 'UTC';
    }

    static getCollection() {
        const db = getFirestore();
        return db.collection('rates');
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
    toAPI() {
        return {
            currency: this.rate_currency,
            name: this.rate_name,
            last_checked: this.updated_at ? DateTime.fromJSDate(this.updated_at).toUnixInteger() : null,
            last_updated: this.rate_updated_at ? DateTime.fromJSDate(this.rate_updated_at).toUnixInteger() : null,
            rate: this.rate,
            last_rate: this.last_rate,
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

        // Apply "updated" scope with separate queries (status = true OR updated within last week)
        if (filters.applyUpdatedScope !== false) { // default to true unless explicitly disabled
            const oneWeekAgo = DateTime.now().minus({ weeks: 1 }).toJSDate();

            // Query 1: Records with status = true
            let activeQuery = Rate.getCollection();
            Object.entries(baseFilters).forEach(([key, value]) => {
                if (key === 'dateAfter') {
                    activeQuery = activeQuery.where('rate_updated_at', '>', value);
                } else {
                    activeQuery = activeQuery.where(key, '==', value);
                }
            });
            activeQuery = activeQuery.where('status', '==', true);
            queries.push(activeQuery);

            // Query 2: Records updated within last week (regardless of status)
            let recentQuery = Rate.getCollection();
            Object.entries(baseFilters).forEach(([key, value]) => {
                if (key === 'dateAfter') {
                    recentQuery = recentQuery.where('rate_updated_at', '>', value);
                } else {
                    recentQuery = recentQuery.where(key, '==', value);
                }
            });
            recentQuery = recentQuery.where('updated_at', '>', Timestamp.fromDate(oneWeekAgo));
            queries.push(recentQuery);
        } else {
            // Single query without updated scope
            let query = Rate.getCollection();
            Object.entries(baseFilters).forEach(([key, value]) => {
                if (key === 'dateAfter') {
                    query = query.where('rate_updated_at', '>', value);
                } else {
                    query = query.where(key, '==', value);
                }
            });

            if (filters.status !== undefined) {
                query = query.where('status', '==', filters.status);
            }

            queries.push(query);
        }

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
                    const rateValues = _.map(currencyRates, 'rate');
                    const lastRateValues = _.map(currencyRates, 'last_rate');
                    const medianRate = _.sortBy(rateValues)[Math.floor(rateValues.length / 2)];
                    const medianLastRate = _.sortBy(lastRateValues)[Math.floor(lastRateValues.length / 2)];

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

    // Get unique currencies from the database
    static async getUniqueCurrencies() {
        const oneWeekAgo = DateTime.now().minus({ weeks: 1 }).toJSDate();

        const [activeSnapshot, recentSnapshot] = await Promise.all([
            Rate.getCollection()
                .where('enabled', '==', true)
                .where('status', '==', true)
                .select('rate_currency')
                .get(),
            Rate.getCollection()
                .where('enabled', '==', true)
                .where('updated_at', '>', Timestamp.fromDate(oneWeekAgo))
                .select('rate_currency')
                .get()
        ]);

        return _.chain([...activeSnapshot.docs, ...recentSnapshot.docs])
            .map(doc => doc.data().rate_currency)
            .compact()
            .map(c => c.toUpperCase())
            .uniq()
            .sort()
            .value();
    }

    /**
     * Upsert rates returned by the AI scraper for a given source.
     * For each extracted rate: find existing (source_id + rate_currency) or create new.
     * Shifts current rate → last_rate and saves new rate value.
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
                        rate: parseFloat(extracted.rate),
                        last_rate: parseFloat(extracted.rate), // no previous on first scrape
                        rate_updated_at: rateUpdatedAt.toDate(),
                        status: true,
                        enabled: true,
                        status_message: '',
                        created_at: now.toDate(),
                        updated_at: now.toDate()
                    });

                    const docRef = Rate.getCollection().doc();
                    batch.set(docRef, newRate.toFirestore());
                    results.push({ action: 'created', currency });
                } else {
                    const docRef = existing.docs[0].ref;
                    const oldRate = existing.docs[0].data().rate || 0;

                    batch.update(docRef, {
                        last_rate: oldRate,
                        rate: parseFloat(extracted.rate),
                        rate_updated_at: rateUpdatedAt,
                        status: true,
                        status_message: '',
                        updated_at: now
                    });
                    results.push({ action: 'updated', currency });
                }
            }

            await batch.commit();
        }

        // Remove rates for this source that were not in the scraped set.
        // This prevents stale records accumulating when a page stops listing a rate variant.
        const scrapedKeys = new Set(
            deduped.map(r => {
                const name = r.name
                    ? `${source.name} - ${r.name}`
                    : `${source.name} - ${r.currency.toUpperCase()}`;
                return `${r.currency.toUpperCase()}::${name}`;
            })
        );

        const allSourceRates = await Rate.getCollection()
            .where('source_id', '==', source.id)
            .get();

        const deleteBatch = db.batch();
        let deleteCount = 0;
        allSourceRates.docs.forEach(doc => {
            const data = doc.data();
            const key = `${(data.rate_currency || '').toUpperCase()}::${data.rate_name || ''}`;
            if (!scrapedKeys.has(key)) {
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
