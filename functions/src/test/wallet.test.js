/**
 * Wallet retention sweep.
 *
 * Realtime Database has no TTL policy, so these rows are deleted by a scheduled pass rather
 * than expiring on their own. What is worth pinning down is that it reads `purgeAt` and not
 * `expiresAt` — an expired grant is still shown in history and is still visible to the overdraw
 * normaliser, so sweeping on expiry would take rows that are still doing work.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

/**
 * A tree of `path -> { key: { purgeAt } }`, queried the way the sweep queries it.
 * `users` answers key listings; everything else answers an orderByChild('purgeAt') range.
 */
const tree = {};
const updates = [];

vi.mock('firebase-admin/database', () => {
    const snapshotOf = (entries) => ({
        exists: () => entries.length > 0,
        forEach: (fn) => entries.forEach(([key, value]) => fn({ key, val: () => value })),
    });

    const makeRef = (path) => {
        const state = { path, endAt: null, startAfter: null, limit: null, child: null };

        const ref = {
            orderByKey: () => ref,
            orderByChild: (field) => { state.child = field; return ref; },
            endAt: (value) => { state.endAt = value; return ref; },
            startAfter: (value) => { state.startAfter = value; return ref; },
            limitToFirst: (value) => { state.limit = value; return ref; },
            update: async (payload) => { updates.push({ path: state.path, payload }); },
            get: async () => {
                let entries = Object.entries(tree[state.path] ?? {});

                if (state.child !== null) {
                    entries = entries.filter(([, row]) => row[state.child] <= state.endAt);
                } else {
                    entries = entries.sort(([a], [b]) => a.localeCompare(b));
                    if (state.startAfter !== null) {
                        entries = entries.filter(([key]) => key > state.startAfter);
                    }
                    if (state.limit !== null) entries = entries.slice(0, state.limit);
                }

                return snapshotOf(entries);
            },
        };

        return ref;
    };

    return { getDatabase: vi.fn(() => ({ ref: (path) => makeRef(path) })) };
});

import { purgeExpiredWallets } from '../utils/wallet.js';

const NOW = Math.floor(Date.now() / 1000);
const LONG_AGO = NOW - 60 * 60 * 24;
const AHEAD = NOW + 60 * 60 * 24;

describe('purgeExpiredWallets', () => {
    beforeEach(() => {
        Object.keys(tree).forEach(key => delete tree[key]);
        updates.length = 0;
    });

    it('removes only rows whose purgeAt has passed', async () => {
        tree['users'] = { alice: true };
        tree['users/alice/rewards'] = {
            stale: { purgeAt: LONG_AGO },
            current: { purgeAt: AHEAD },
        };
        tree['users/alice/spends'] = {};

        const removed = await purgeExpiredWallets();

        expect(removed).toBe(1);
        expect(updates).toHaveLength(1);
        expect(updates[0].payload).toEqual({ stale: null });
    });

    it('does not sweep on expiresAt — an expired grant is still live history', async () => {
        tree['users'] = { alice: true };
        tree['users/alice/rewards'] = {
            // Expired months ago, but still inside its retention window.
            expired: { expiresAt: LONG_AGO, purgeAt: AHEAD },
        };
        tree['users/alice/spends'] = {};

        const removed = await purgeExpiredWallets();

        expect(removed).toBe(0);
        expect(updates).toHaveLength(0);
    });

    it('sweeps spends as well as rewards', async () => {
        tree['users'] = { alice: true };
        tree['users/alice/rewards'] = { gone: { purgeAt: LONG_AGO } };
        tree['users/alice/spends'] = { also: { purgeAt: LONG_AGO } };

        const removed = await purgeExpiredWallets();

        expect(removed).toBe(2);
        expect(updates.map(u => u.path)).toEqual([
            'users/alice/rewards',
            'users/alice/spends',
        ]);
    });

    it('walks every user', async () => {
        tree['users'] = { alice: true, bob: true };
        tree['users/alice/rewards'] = { a: { purgeAt: LONG_AGO } };
        tree['users/alice/spends'] = {};
        tree['users/bob/rewards'] = { b: { purgeAt: LONG_AGO } };
        tree['users/bob/spends'] = {};

        expect(await purgeExpiredWallets()).toBe(2);
    });

    it('is a no-op on an empty database', async () => {
        expect(await purgeExpiredWallets()).toBe(0);
        expect(updates).toHaveLength(0);
    });
});
