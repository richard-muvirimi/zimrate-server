import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';

class Option {
    constructor(data = {}) {
        this.id = data.id || null;
        this.key = data.key || '';
        this.value = data.value || '';
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    static getCollection() {
        const db = getFirestore();
        return db.collection('options');
    }

    // Convert to Firestore format
    toFirestore() {
        const data = { ...this };
        delete data.id;

        // Convert dates to Firestore Timestamps using Luxon
        if (this.created_at && !(this.created_at instanceof Timestamp)) {
            if (this.created_at instanceof Date) {
                data.created_at = Timestamp.fromDate(this.created_at);
            } else if (typeof this.created_at === 'string') {
                data.created_at = Timestamp.fromDate(DateTime.fromISO(this.created_at).toJSDate());
            } else {
                data.created_at = Timestamp.fromMillis(this.created_at);
            }
        }

        if (this.updated_at && !(this.updated_at instanceof Timestamp)) {
            if (this.updated_at instanceof Date) {
                data.updated_at = Timestamp.fromDate(this.updated_at);
            } else if (typeof this.updated_at === 'string') {
                data.updated_at = Timestamp.fromDate(DateTime.fromISO(this.updated_at).toJSDate());
            } else {
                data.updated_at = Timestamp.fromMillis(this.updated_at);
            }
        }

        return data;
    }

    // Convert from Firestore format
    static fromFirestore(doc) {
        const data = doc.data();

        // Convert Firestore Timestamps back to JavaScript Dates
        if (data.created_at && data.created_at.toDate) {
            data.created_at = data.created_at.toDate();
        }

        if (data.updated_at && data.updated_at.toDate) {
            data.updated_at = data.updated_at.toDate();
        }

        return new Option({ id: doc.id, ...data });
    }

    // Save to Firestore
    async save() {
        const collection = Option.getCollection();
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

    // Static method to get option by key
    static async getByKey(key) {
        const snapshot = await Option.getCollection()
            .where('key', '==', key)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        return Option.fromFirestore(snapshot.docs[0]);
    }

    // Static method to get option value by key with fallback
    static async getValue(key, defaultValue = null) {
        const option = await Option.getByKey(key);
        return option ? option.value : defaultValue;
    }

    // Static method to set option value
    static async setValue(key, value) {
        const existingOption = await Option.getByKey(key);

        if (existingOption) {
            existingOption.value = value;
            return await existingOption.save();
        } else {
            const newOption = new Option({ key, value });
            return await newOption.save();
        }
    }

    // Get all options as key-value pairs
    static async getAll() {
        const snapshot = await Option.getCollection().get();
        const options = {};

        snapshot.docs.forEach(doc => {
            const option = Option.fromFirestore(doc);
            options[option.key] = option.value;
        });

        return options;
    }
}

export default Option;
