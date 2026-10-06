import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';

class Source {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.url = data.url || '';
        this.enabled = data.enabled !== undefined ? data.enabled : true;
        this.javascript = data.javascript || false;
        this.last_scraped = data.last_scraped || null;
        // Unlike last_scraped, only a scrape that stored rates sets this: rates
        // its source scrapes successfully without stop being served.
        this.last_success = data.last_success || null;
        this.status = data.status !== undefined ? data.status : false;
        this.status_message = data.status_message || '';
        // A source on probation is scraped, but its rates are not served until
        // it has gone probation_days without a reading refused or a scrape
        // failing; clean_since is when the current clean run began.
        this.probation = data.probation === true;
        this.clean_since = data.clean_since || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    static getCollection() {
        const db = getFirestore();
        return db.collection('sources');
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

        data.last_scraped = toTimestamp(this.last_scraped);
        data.last_success = toTimestamp(this.last_success);
        data.clean_since = toTimestamp(this.clean_since);
        data.created_at = toTimestamp(this.created_at);
        data.updated_at = toTimestamp(this.updated_at);

        return data;
    }

    // Convert from Firestore format
    static fromFirestore(doc) {
        const data = doc.data();

        const toDate = (val) => (val && val.toDate) ? val.toDate() : val;

        data.last_scraped = toDate(data.last_scraped);
        data.last_success = toDate(data.last_success);
        data.clean_since = toDate(data.clean_since);
        data.created_at = toDate(data.created_at);
        data.updated_at = toDate(data.updated_at);

        return new Source({ id: doc.id, ...data });
    }

    // Save to Firestore (upsert)
    async save() {
        const collection = Source.getCollection();
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

    // Query sources with optional filters
    static async findAll(filters = {}) {
        let query = Source.getCollection();

        if (filters.enabled !== undefined) {
            query = query.where('enabled', '==', filters.enabled);
        }

        const snapshot = await query.orderBy('updated_at', 'desc').get();
        return snapshot.docs.map(doc => Source.fromFirestore(doc));
    }

    // Find a single source by ID
    static async findById(id) {
        const doc = await Source.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return Source.fromFirestore(doc);
    }

    // Find a source by URL (used during import deduplication)
    static async findByUrl(url) {
        const snapshot = await Source.getCollection()
            .where('url', '==', url)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        return Source.fromFirestore(snapshot.docs[0]);
    }
}

export default Source;
