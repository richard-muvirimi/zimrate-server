/**
 * Wallet retention sweep and economy snapshot.
 *
 * Realtime Database has no TTL policy, so these rows are deleted by a scheduled pass rather
 * than expiring on their own. What is worth pinning down is that it reads `purgeAt` and not
 * `expiresAt` — an expired grant is still shown in history and is still visible to the overdraw
 * normaliser, so sweeping on expiry would take rows that are still doing work.
 *
 * The same pass totals what survives into stats/economy, so the other thing worth pinning down
 * is that the totals describe the post-purge state, not what was there when the walk started.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

/** Auth accounts, paged the way listUsers pages them. */
let authUsers = [];

vi.mock('firebase-admin/auth', () => ({
    getAuth: vi.fn(() => ({
        listUsers: async (limit, pageToken) => {
            const from = pageToken ? Number(pageToken) : 0;
            const users = authUsers.slice(from, from + limit);
            const next = from + limit;

            return { users, pageToken: next < authUsers.length ? String(next) : undefined };
        },
    })),
}));

/**
 * A tree of `path -> { key: row }`. `users` is read as a key listing, ordered and paged;
 * every other path is read whole, which is what the sweep does now that the totals need every
 * surviving row anyway.
 */
const tree = {};
const updates = [];
const writes = {};

vi.mock('firebase-admin/database', () => {
    const snapshotOf = (entries) => ({
        exists: () => entries.length > 0,
        forEach: (fn) => entries.forEach(([key, value]) => fn({ key, val: () => value })),
    });

    const makeRef = (path) => {
        const state = { path, startAfter: null, limit: null };

        const ref = {
            orderByKey: () => ref,
            startAfter: (value) => { state.startAfter = value; return ref; },
            limitToFirst: (value) => { state.limit = value; return ref; },
            update: async (payload) => { updates.push({ path: state.path, payload }); },
            set: async (payload) => { writes[state.path] = payload; },
            get: async () => {
                let entries = Object.entries(tree[state.path] ?? {})
                    .sort(([a], [b]) => a.localeCompare(b));

                if (state.startAfter !== null) {
                    entries = entries.filter(([key]) => key > state.startAfter);
                }
                if (state.limit !== null) entries = entries.slice(0, state.limit);

                return snapshotOf(entries);
            },
        };

        return ref;
    };

    return { getDatabase: vi.fn(() => ({ ref: (path) => makeRef(path) })) };
});

import { sweepWallets } from '../utils/wallet.js';

const NOW = Math.floor(Date.now() / 1000);
const DAY = 60 * 60 * 24;
const LONG_AGO = NOW - DAY;
const AHEAD = NOW + DAY;

/** A grant carrying every field the sweep reads, so each test states only what it is about. */
const reward = (over = {}) => ({
    amount: 0,
    balance: 0,
    type: 'clock-in',
    createdAt: NOW,
    expiresAt: AHEAD,
    purgeAt: AHEAD,
    ...over,
});

const spend = (over = {}) => ({
    amount: 0,
    type: 'data-fetch',
    createdAt: NOW,
    purgeAt: AHEAD,
    ...over,
});

describe('sweepWallets', () => {
    beforeEach(() => {
        Object.keys(tree).forEach(key => delete tree[key]);
        Object.keys(writes).forEach(key => delete writes[key]);
        updates.length = 0;
        authUsers = [];
    });

    describe('retention', () => {
        it('removes only rows whose purgeAt has passed', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = {
                stale: reward({ purgeAt: LONG_AGO }),
                current: reward({ purgeAt: AHEAD }),
            };

            const { removed } = await sweepWallets();

            expect(removed).toBe(1);
            expect(updates).toHaveLength(1);
            expect(updates[0].payload).toEqual({ stale: null });
        });

        it('does not sweep on expiresAt — an expired grant is still live history', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = {
                // Expired months ago, but still inside its retention window.
                expired: reward({ expiresAt: LONG_AGO, purgeAt: AHEAD }),
            };

            const { removed } = await sweepWallets();

            expect(removed).toBe(0);
            expect(updates).toHaveLength(0);
        });

        it('sweeps spends as well as rewards', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = { gone: reward({ purgeAt: LONG_AGO }) };
            tree['users/alice/spends'] = { also: spend({ purgeAt: LONG_AGO }) };

            const { removed } = await sweepWallets();

            expect(removed).toBe(2);
            expect(updates.map(u => u.path)).toEqual([
                'users/alice/rewards',
                'users/alice/spends',
            ]);
        });

        it('walks every user', async () => {
            tree['users'] = { alice: true, bob: true };
            tree['users/alice/rewards'] = { a: reward({ purgeAt: LONG_AGO }) };
            tree['users/bob/rewards'] = { b: reward({ purgeAt: LONG_AGO }) };

            const { removed } = await sweepWallets();

            expect(removed).toBe(2);
        });

        it('is a no-op on an empty database', async () => {
            const { removed, stats } = await sweepWallets();

            expect(removed).toBe(0);
            expect(updates).toHaveLength(0);
            expect(stats.users).toBe(0);
        });
    });

    describe('totals', () => {
        it('counts only unexpired balances as outstanding', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = {
                live: reward({ balance: 7, expiresAt: AHEAD }),
                // Still retained, so it stays in history — but it can no longer be spent.
                dead: reward({ balance: 5, expiresAt: LONG_AGO }),
            };

            const { stats } = await sweepWallets();

            expect(stats.coinsOutstanding).toBe(7);
            expect(stats.usersWithBalance).toBe(1);
            expect(stats.usersOverdrawn).toBe(0);
        });

        it('counts an overdrawn account rather than clamping it to zero', async () => {
            tree['users'] = { alice: true, bob: true };
            // Two handsets drew on the same grant — allowed by design, and worth surfacing.
            tree['users/alice/rewards'] = { over: reward({ balance: -3 }) };
            tree['users/bob/rewards'] = { fine: reward({ balance: 4 }) };

            const { stats } = await sweepWallets();

            expect(stats.coinsOutstanding).toBe(1);
            expect(stats.usersOverdrawn).toBe(1);
            expect(stats.usersWithBalance).toBe(1);
            expect(stats.users).toBe(2);
        });

        it('excludes rows it just purged', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = {
                kept: reward({ amount: 2, balance: 2 }),
                gone: reward({ amount: 99, balance: 99, purgeAt: LONG_AGO }),
            };

            const { stats } = await sweepWallets();

            expect(stats.coinsOutstanding).toBe(2);
            expect(stats.granted.retained).toBe(2);
        });

        it('buckets grants by type and tracks purchases separately', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = {
                a: reward({ type: 'clock-in', amount: 1 }),
                b: reward({ type: 'clock-in', amount: 4 }),
                c: reward({ type: 'purchase', amount: 50 }),
            };

            const { stats } = await sweepWallets();

            expect(stats.grantsByType['clock-in']).toEqual({ count: 2, coins: 5 });
            expect(stats.grantsByType['purchase']).toEqual({ count: 1, coins: 50 });
            expect(stats.purchases).toEqual({
                count: 1, coins: 50, last30dCount: 1, last30dCoins: 50,
            });
        });

        it('windows granted and spent by createdAt', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = {
                today: reward({ amount: 3, createdAt: NOW }),
                lastWeek: reward({ amount: 5, createdAt: NOW - 7 * DAY }),
                lastYear: reward({ amount: 9, createdAt: NOW - 300 * DAY }),
            };
            tree['users/alice/spends'] = {
                today: spend({ amount: 2, createdAt: NOW }),
                lastWeek: spend({ amount: 6, createdAt: NOW - 7 * DAY }),
            };

            const { stats } = await sweepWallets();

            expect(stats.granted).toEqual({ last24h: 3, last30d: 8, retained: 17 });
            expect(stats.spent).toEqual({ last24h: 2, last30d: 8, retained: 8 });
        });

        it('treats a missing or non-numeric field as zero rather than NaN', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = {
                // These rows are written by app clients, so the sweep cannot assume the shape.
                bad: { amount: 'lots', balance: null, expiresAt: AHEAD, purgeAt: AHEAD },
            };

            const { stats } = await sweepWallets();

            expect(stats.coinsOutstanding).toBe(0);
            expect(stats.granted.retained).toBe(0);
        });

        it('splits auth accounts by whether they can be signed back into', async () => {
            const account = (providers, createdDaysAgo) => ({
                providerData: providers,
                metadata: {
                    creationTime: new Date((NOW - createdDaysAgo * DAY) * 1000).toUTCString(),
                },
            });

            authUsers = [
                account([], 1),                          // anonymous, this week
                account([], 100),                        // anonymous, old
                account([{ providerId: 'google.com' }], 2), // linked, this week
            ];

            const { stats } = await sweepWallets();

            expect(stats.accounts).toEqual({
                total: 3, anonymous: 2, linked: 1, newLast7d: 2,
            });
        });

        it('pages through more auth accounts than one listUsers call returns', async () => {
            authUsers = Array.from({ length: 1500 }, () => ({
                providerData: [],
                metadata: { creationTime: new Date(0).toUTCString() },
            }));

            const { stats } = await sweepWallets();

            expect(stats.accounts.total).toBe(1500);
            expect(stats.accounts.newLast7d).toBe(0);
        });

        it('writes the snapshot where the dashboard reads it', async () => {
            tree['users'] = { alice: true };
            tree['users/alice/rewards'] = { a: reward({ balance: 3 }) };

            const { stats } = await sweepWallets();

            expect(writes['stats/economy']).toEqual(stats);
            expect(writes['stats/economy'].computedAt).toBeGreaterThan(0);
        });
    });
});
