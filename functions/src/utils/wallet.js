import {getAuth} from "firebase-admin/auth";
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
 * Pages of 1000 to walk when counting auth accounts. Generous because this runs nightly inside a
 * 540s budget rather than on a request, but still bounded so a runaway cannot spin forever.
 *
 * @type {number}
 */
const MAX_AUTH_PAGES = 50;

/** Where the nightly economy snapshot is written for the admin dashboard to read. */
const STATS_PATH = 'stats/economy';

const DAY_SECONDS = 60 * 60 * 24;

/**
 * Walks every wallet once: deletes rows past their retention window, and totals what is left.
 *
 * The two jobs share a walk because the walk is the expensive part. Realtime Database has no TTL
 * policy and no aggregation, so both are O(all users) either way; doing them separately would
 * mean paging the whole user list twice for one night's work.
 *
 * Retention reads `purgeAt` and deliberately not `expiresAt`: an expired grant still has to
 * appear in history and still has to be visible to the overdraw normaliser, so purging on expiry
 * would take rows that are still doing work. `purgeAt` sits six months past expiry, which
 * reproduces what the app's old `cleanExpired` queries did on every launch.
 *
 * @returns {Promise<{removed: number, stats: object}>}
 */
export const sweepWallets = async () => {
    const now = Math.floor(DateTime.now().toSeconds());
    const totals = emptyTotals(now);

    let removed = 0;
    let after = null;

    for (;;) {
        const page = await readUserPage(after);
        if (page.length === 0) break;

        for (const uid of page) {
            removed += await sweepUser(uid, now, totals);
        }

        if (page.length < USER_PAGE_SIZE) break;
        after = page[page.length - 1];
    }

    // Counted here rather than on each dashboard load: anonymous-versus-linked lives in Auth, not
    // in the database, so it needs its own walk — and a walk per page view is not something the
    // dashboard should be paying for. A figure up to a day old is what the rest of this snapshot
    // is anyway.
    totals.accounts = await countAccounts(now);

    await getDatabase().ref(STATS_PATH).set(totals);

    return {removed, stats: totals};
};

/**
 * One account's surviving grants and spends, with the balance the app would show.
 *
 * Shares {@link outstanding} with the nightly totals on purpose — two definitions of "balance"
 * that drift apart is exactly the bug that makes a support page untrustworthy.
 *
 * @param uid {string}
 * @returns {Promise<{rewards: Array, spends: Array, outstanding: number}>}
 */
export const readWallet = async (uid) => {
    const now = Math.floor(DateTime.now().toSeconds());
    const rewards = await readRows(`users/${uid}/rewards`);
    const spends = await readRows(`users/${uid}/spends`);

    return {
        rewards: rewards.map(({key, row}) => ({key, ...row})),
        spends: spends.map(({key, row}) => ({key, ...row})),
        outstanding: outstanding(rewards, now),
    };
};

/**
 * Just the spendable balance, for a list that shows one number per account.
 *
 * @param uid {string}
 * @returns {Promise<number>}
 */
export const readBalance = async (uid) => {
    const now = Math.floor(DateTime.now().toSeconds());

    return outstanding(await readRows(`users/${uid}/rewards`), now);
};

/**
 * Counts auth accounts, split by whether they can ever be signed back into.
 *
 * An anonymous account has no provider, so it is reachable only from the handset that created
 * it — which is what makes "sign in to keep your coins" worth saying in the app, and what makes
 * this split worth watching here.
 *
 * @param now {number}
 * @returns {Promise<{total: number, anonymous: number, linked: number, newLast7d: number}>}
 */
const countAccounts = async (now) => {
    const counts = {total: 0, anonymous: 0, linked: 0, newLast7d: 0};
    const weekAgo = (now - 7 * DAY_SECONDS) * 1000;

    let pageToken;
    for (let i = 0; i < MAX_AUTH_PAGES; i++) {
        const page = await getAuth().listUsers(1000, pageToken);

        for (const user of page.users) {
            counts.total += 1;
            if ((user.providerData ?? []).length === 0) counts.anonymous += 1;
            else counts.linked += 1;

            // Reported as an HTTP date string, not ISO.
            const created = Date.parse(user.metadata?.creationTime ?? '');
            if (Number.isFinite(created) && created >= weekAgo) counts.newLast7d += 1;
        }

        pageToken = page.pageToken;
        if (!pageToken) break;
    }

    return counts;
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
 * Purges and totals one account, reading each collection exactly once.
 *
 * Reads the collection whole rather than running the `orderByChild('purgeAt')` range the purge
 * alone needed: the totals need every surviving row anyway, so a filtered query would only mean
 * fetching the same node twice.
 *
 * @param uid {string}
 * @param now {number} - Epoch seconds; rows with a purgeAt at or before this go.
 * @param totals {object} - Mutated in place.
 * @returns {Promise<number>} rows removed for this user.
 */
const sweepUser = async (uid, now, totals) => {
    totals.users += 1;

    const rewards = await readRows(`users/${uid}/rewards`);
    const spends = await readRows(`users/${uid}/spends`);

    const removed =
        await purge(`users/${uid}/rewards`, rewards, now) +
        await purge(`users/${uid}/spends`, spends, now);

    tallyUser(rewards, spends, now, totals);

    return removed;
};

/**
 * @param path {string}
 * @returns {Promise<Array<{key: string, row: object}>>}
 */
const readRows = async (path) => {
    const snapshot = await getDatabase().ref(path).get();
    if (!snapshot.exists()) return [];

    const rows = [];
    snapshot.forEach(child => {
        const row = child.val();
        // A node that is not an object is not a row this code wrote; skipping keeps one bad
        // write from throwing the whole nightly sweep.
        if (row !== null && typeof row === 'object') rows.push({key: child.key, row});
    });

    return rows;
};

/**
 * Deletes the rows whose retention window has elapsed, and drops them from [rows] so the totals
 * describe what survives.
 *
 * @param path {string}
 * @param rows {Array<{key: string, row: object}>} - Filtered in place.
 * @param now {number}
 * @returns {Promise<number>}
 */
const purge = async (path, rows, now) => {
    const updates = {};

    for (let i = rows.length - 1; i >= 0; i--) {
        if (num(rows[i].row.purgeAt) > now) continue;

        updates[rows[i].key] = null;
        rows.splice(i, 1);
    }

    const count = Object.keys(updates).length;
    if (count === 0) return 0;

    await getDatabase().ref(path).update(updates);
    logger.log(`Purged ${count} rows from ${path}`);

    return count;
};

/**
 * Folds one account's surviving rows into the running totals.
 *
 * @param rewards {Array<{key: string, row: object}>}
 * @param spends {Array<{key: string, row: object}>}
 * @param now {number}
 * @param totals {object} - Mutated in place.
 */
const tallyUser = (rewards, spends, now, totals) => {
    const dayAgo = now - DAY_SECONDS;
    const monthAgo = now - 30 * DAY_SECONDS;

    const balance = outstanding(rewards, now);

    for (const {row} of rewards) {
        const amount = num(row.amount);
        const createdAt = num(row.createdAt);
        const type = typeof row.type === 'string' ? row.type : 'unknown';

        totals.granted.retained += amount;
        if (createdAt >= dayAgo) totals.granted.last24h += amount;
        if (createdAt >= monthAgo) totals.granted.last30d += amount;

        const bucket = totals.grantsByType[type] ??= {count: 0, coins: 0};
        bucket.count += 1;
        bucket.coins += amount;

        if (type === 'purchase') {
            totals.purchases.count += 1;
            totals.purchases.coins += amount;
            if (createdAt >= monthAgo) {
                totals.purchases.last30dCount += 1;
                totals.purchases.last30dCoins += amount;
            }
        }
    }

    for (const {row} of spends) {
        const amount = num(row.amount);
        const createdAt = num(row.createdAt);

        totals.spent.retained += amount;
        if (createdAt >= dayAgo) totals.spent.last24h += amount;
        if (createdAt >= monthAgo) totals.spent.last30d += amount;
    }

    totals.coinsOutstanding += balance;
    if (balance > 0) totals.usersWithBalance += 1;
    // Negative means coins were spent on one handset that another had already drawn — allowed by
    // design, so this is a health number to watch rather than a fault to fix.
    if (balance < 0) totals.usersOverdrawn += 1;
};

/**
 * What the account can still spend: the balances of grants that have not expired.
 *
 * Mirrors `Reward.isActiveAt` in the app — expiry is inclusive — and deliberately does not clamp
 * at zero, because an overdrawn wallet is a state the design allows and the dashboard needs to
 * be able to see.
 *
 * @param rewards {Array<{row: object}>}
 * @param now {number}
 * @returns {number}
 */
const outstanding = (rewards, now) => rewards.reduce(
    (sum, {row}) => (num(row.expiresAt) >= now ? sum + num(row.balance) : sum),
    0,
);

/**
 * `retained` rather than all-time throughout: rows older than the retention window have been
 * deleted by the pass above, so no total here can see further back than that.
 *
 * @param now {number}
 */
const emptyTotals = (now) => ({
    computedAt: now,
    users: 0,
    usersWithBalance: 0,
    usersOverdrawn: 0,
    coinsOutstanding: 0,
    granted: {last24h: 0, last30d: 0, retained: 0},
    spent: {last24h: 0, last30d: 0, retained: 0},
    grantsByType: {},
    purchases: {count: 0, coins: 0, last30dCount: 0, last30dCoins: 0},
    accounts: {total: 0, anonymous: 0, linked: 0, newLast7d: 0},
});

/**
 * Realtime Database hands back whatever was written, and these rows are written by app clients.
 * A missing or non-numeric field is treated as zero rather than poisoning every total with NaN.
 *
 * @param value {unknown}
 * @returns {number}
 */
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
