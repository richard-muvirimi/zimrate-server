/**
 * Play-verified coin purchases.
 *
 * The app used to write these grants itself, naming its own amount. What matters here is that it
 * no longer can: the amount comes from the server's own catalogue, the token is checked with
 * Google, and one payment credits exactly one wallet exactly once — however many times it is
 * presented, and whoever presents it.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import express from 'express';

vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    setGlobalOptions: vi.fn(),
}));

/** Decoded token the auth middleware will see. Reassigned per test. */
let decodedToken = { uid: 'buyer1', firebase: { sign_in_provider: 'google.com' } };

vi.mock('firebase-admin/auth', () => ({
    getAuth: vi.fn(() => ({
        verifyIdToken: vi.fn(async () => decodedToken),
    })),
}));

vi.mock('firebase-admin/app-check', () => ({
    getAppCheck: vi.fn(() => ({ verifyToken: vi.fn(async () => ({})) })),
}));

/** A flat `path -> value` store, with root update() splitting multi-path writes. */
const tree = {};

vi.mock('firebase-admin/database', () => {
    const makeRef = (path = '') => ({
        get: async () => ({
            exists: () => tree[path] !== undefined,
            val: () => tree[path],
        }),
        update: async (payload) => {
            Object.entries(payload).forEach(([child, value]) => {
                tree[child ? `${path ? `${path}/` : ''}${child}` : path] = value;
            });
        },
    });

    return { getDatabase: vi.fn(() => ({ ref: (path) => makeRef(path ?? '') })) };
});

/** What Play says about the token under test. */
let playResponse = { status: 200, body: { purchaseState: 0, quantity: 1, orderId: 'GPA.1' } };
const fetchCalls = [];

vi.stubGlobal('fetch', vi.fn(async (url) => {
    fetchCalls.push(url);
    return {
        ok: playResponse.status >= 200 && playResponse.status < 300,
        status: playResponse.status,
        json: async () => playResponse.body,
        text: async () => JSON.stringify(playResponse.body),
    };
}));

vi.mock('google-auth-library', () => ({
    GoogleAuth: class {
        async getAccessToken() { return 'service-account-token'; }
    },
}));

const { default: apiRoutes } = await import('../routes/api.js');
const { errorHandler } = await import('../middleware/error.js');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);
app.use(errorHandler);
const request = supertest(app);

const TOKEN = 'play-token-abcdef';
// SHA-256 of TOKEN, first sixteen bytes as hex — the same derivation the app used, so grants
// written before this endpoint existed share one key space with the ones written by it.
const KEY = 'p_' + (await import('node:crypto'))
    .createHash('sha256').update(TOKEN, 'utf8').digest('hex').slice(0, 32);

const buy = (body = {}) => request
    .post('/api/wallet/purchase')
    .set('Authorization', 'Bearer id-token')
    .send({ productId: 'medium_donation', purchaseToken: TOKEN, ...body });

describe('POST /api/wallet/purchase', () => {
    beforeEach(() => {
        Object.keys(tree).forEach(key => delete tree[key]);
        decodedToken = { uid: 'buyer1', firebase: { sign_in_provider: 'google.com' } };
        playResponse = { status: 200, body: { purchaseState: 0, quantity: 1, orderId: 'GPA.1' } };
        fetchCalls.length = 0;
    });

    it('requires a signed-in caller', async () => {
        const res = await request.post('/api/wallet/purchase').send({});
        expect(res.status).toBe(401);
    });

    it('refuses an anonymous account, whose coins could never be recovered', async () => {
        decodedToken = { uid: 'anon1', firebase: { sign_in_provider: 'anonymous' } };

        const res = await buy();

        expect(res.status).toBe(403);
        expect(fetchCalls).toHaveLength(0);
    });

    it('credits the catalogue amount, not anything the caller asks for', async () => {
        // The body names a huge pack's worth of coins; it must be ignored entirely.
        const res = await buy({ amount: 999_999, coins: 999_999 });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ credited: true, coins: 2000 });
        expect(tree[`users/buyer1/rewards/${KEY}`]).toMatchObject({
            amount: 2000, balance: 2000, type: 'purchase',
        });
    });

    it('multiplies by the quantity Play reports, not one the caller sends', async () => {
        playResponse.body = { purchaseState: 0, quantity: 3, orderId: 'GPA.2' };

        const res = await buy({ quantity: 99 });

        expect(res.body.coins).toBe(6000);
    });

    it('rejects a product that is not a coin pack', async () => {
        const res = await buy({ productId: 'not_a_pack' });

        expect(res.status).toBe(400);
        expect(fetchCalls).toHaveLength(0);
    });

    it('rejects a purchase Play has never heard of', async () => {
        playResponse = { status: 404, body: {} };

        const res = await buy();

        expect(res.status).toBe(400);
        expect(tree[`users/buyer1/rewards/${KEY}`]).toBeUndefined();
    });

    it('refuses a pending purchase, which is not paid for yet', async () => {
        playResponse.body = { purchaseState: 2, quantity: 1 };

        const res = await buy();

        expect(res.status).toBe(409);
        expect(tree[`users/buyer1/rewards/${KEY}`]).toBeUndefined();
    });

    it('reports a Play outage as retryable rather than as an invalid purchase', async () => {
        playResponse = { status: 500, body: { error: 'backend error' } };

        const res = await buy();

        expect(res.status).toBe(503);
    });

    it('is a no-op when the same account presents the same token again', async () => {
        const first = await buy();
        expect(first.status).toBe(201);

        const second = await buy();

        expect(second.status).toBe(200);
        expect(second.body).toEqual({ credited: false, alreadyCredited: true, coins: 2000 });
        // Not re-verified and not re-written: the ledger answers on its own.
        expect(fetchCalls).toHaveLength(1);
    });

    it('refuses a token already credited to a different account', async () => {
        await buy();

        decodedToken = { uid: 'thief', firebase: { sign_in_provider: 'google.com' } };
        const res = await buy();

        // Per-user grant keys alone would not collide, so one payment would have credited two
        // wallets. The shared ledger is what stops it.
        expect(res.status).toBe(409);
        expect(tree[`users/thief/rewards/${KEY}`]).toBeUndefined();
    });

    it('writes the ledger entry and the grant together', async () => {
        await buy();

        expect(tree[`purchases/${KEY}`]).toMatchObject({
            uid: 'buyer1', productId: 'medium_donation', coins: 2000, orderId: 'GPA.1',
        });
        expect(tree[`users/buyer1/rewards/${KEY}`]).toBeDefined();
    });

    it('dates the grant so it expires and is then retained for six months', async () => {
        await buy();

        const grant = tree[`users/buyer1/rewards/${KEY}`];
        const days = (grant.expiresAt - grant.createdAt) / 86_400;

        expect(days).toBeGreaterThan(199);
        expect(days).toBeLessThan(202);
        expect((grant.purgeAt - grant.expiresAt) / 86_400).toBeCloseTo(183, 0);
    });

    it('takes the localised description but clamps it to what the rules allow', async () => {
        await buy({ description: 'x'.repeat(500) });

        expect(tree[`users/buyer1/rewards/${KEY}`].description).toHaveLength(200);
    });
});
