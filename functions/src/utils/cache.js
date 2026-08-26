import {getDatabase} from "firebase-admin/database";
import {DateTime} from "luxon";

/**
 * Gets a cache entry by key.
 *
 * @param key {string} - The key of the cache entry.
 * @param fallback {any|string} - Fallback value if cache entry does not exist or is expired.
 *                                 Defaults to an empty string.
 * @returns {Promise<any|string>}
 */
export const getCache = async (key, fallback = "") => {
    const snapshot = await getDatabase().ref('cache/' + key).get();

    if (snapshot.exists() && DateTime.fromMillis(snapshot.child("expires_at").val()) > DateTime.now()) {
        return snapshot.child("value").val();
    }
    await deleteCache(key);
    return fallback;
}

/**
 * Checks if a cache entry exists and is not expired.
 *
 * @param key {string} - The key of the cache entry.
 * @returns {Promise<boolean>}
 */
export const hasCache = async (key) => {
    const snapshot = await getDatabase().ref('cache/' + key).get();

    if (snapshot.exists() && DateTime.fromMillis(snapshot.child("expires_at").val()) > DateTime.now()) {
        return true;
    }
    await deleteCache(key);
    return false;
}

/**
 * Sets a cache entry with an expiration time.
 *
 * @param key {string} - The key for the cache entry.
 * @param value {any} - The value to be cached.
 * @param expires_at {DateTime}
 * @returns {Promise<void>}
 */
export const setCache = async (key, value, expires_at) => {
    await getDatabase().ref('cache/' + key).set({
        value,
        expires_at: expires_at.toMillis(),
    });
}

/**
 * Deletes a cache entry by key.
 *
 * @param key {string} - The key of the cache entry to delete.
 * @returns {Promise<void>}
 */
export const deleteCache = async (key) => {
    await getDatabase().ref('cache/' + key).remove();
}

export const cleanCache = async () => {
    if (!await hasCache("_clean")) {

        const snapshot = await getDatabase()
            .ref('cache')
            .orderByChild("expires_at")
            .endAt(DateTime.now().toMillis())
            .get();

        if (snapshot.exists()) {
            const updates = {};

            snapshot.forEach(childSnapshot => {
                updates[childSnapshot.key] = null;
            });

            await Promise.all([
                getDatabase().ref('cache').update(updates),
                setCache("_clean", "done", DateTime.now().plus({hours: 1}))
            ]);
        }
    }
}