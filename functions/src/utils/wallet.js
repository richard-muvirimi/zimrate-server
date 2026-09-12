import {getDatabase} from "firebase-admin/database";
import {logger} from "firebase-functions";
import {DateTime} from "luxon";

/**
 * How many users to work through in one run. The sweep walks every account, which a Firestore
 * TTL policy would not have to — that is the accepted cost of choosing Realtime Database — so it
 * pages rather than trying to hold the whole user list at once.
 *
 * @type {number}
 */
const USER_PAGE_SIZE = 200;

/**
 * Deletes wallet rows whose retention window has elapsed.
 *
 * Reads `purgeAt` and deliberately not `expiresAt`: an expired grant still has to appear in
 * history and still has to be visible to the overdraw normaliser, so purging on expiry would
 * take rows that are still doing work. `purgeAt` sits six months past expiry, which reproduces
 * what the app's old `cleanExpired` queries did on every launch.
 *
 * Same shape as {@link cleanCache} — collect the matched keys, null them in one update — applied
 * per user and per collection.
 *
 * @returns {Promise<number>} how many rows were removed.
 */
export const purgeExpiredWallets = async () => {
    const now = DateTime.now().toSeconds();
    let removed = 0;
    let after = null;

    for (;;) {
        const page = await readUserPage(after);
        if (page.length === 0) break;

        for (const uid of page) {
            removed += await purgeUser(uid, now);
        }

        if (page.length < USER_PAGE_SIZE) break;
        after = page[page.length - 1];
    }

    return removed;
};

/**
 * One page of user keys, ordered by key so paging is stable.
 *
 * `shallow` is not available through the Admin SDK, so this asks for the keys by limiting to the
 * page size and reading only what the query returns — the alternative, fetching `users` whole,
 * would pull every wallet in the project into memory.
 *
 * @param after {string|null} - The last key of the previous page, exclusive.
 * @returns {Promise<string[]>}
 */
const readUserPage = async (after) => {
    let query = getDatabase().ref('users').orderByKey().limitToFirst(USER_PAGE_SIZE);
    if (after !== null) {
        query = getDatabase().ref('users')
            .orderByKey()
            .startAfter(after)
            .limitToFirst(USER_PAGE_SIZE);
    }

    const snapshot = await query.get();
    if (!snapshot.exists()) return [];

    const keys = [];
    snapshot.forEach(child => {
        keys.push(child.key);
    });

    return keys;
};

/**
 * @param uid {string}
 * @param now {number} - Epoch seconds; rows with a purgeAt at or before this go.
 * @returns {Promise<number>}
 */
const purgeUser = async (uid, now) => {
    const rewards = await purgeCollection(`users/${uid}/rewards`, now);
    const spends = await purgeCollection(`users/${uid}/spends`, now);

    return rewards + spends;
};

/**
 * @param path {string}
 * @param now {number}
 * @returns {Promise<number>}
 */
const purgeCollection = async (path, now) => {
    const snapshot = await getDatabase()
        .ref(path)
        .orderByChild('purgeAt')
        .endAt(now)
        .get();

    if (!snapshot.exists()) return 0;

    const updates = {};
    snapshot.forEach(child => {
        updates[child.key] = null;
    });

    const count = Object.keys(updates).length;
    if (count === 0) return 0;

    await getDatabase().ref(path).update(updates);
    logger.log(`Purged ${count} rows from ${path}`);

    return count;
};
