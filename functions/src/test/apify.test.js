/**
 * Waiting out Apify's concurrent-run limit. fetch is stubbed and the clock is
 * fake, so the two-minute wait runs instantly.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runActor } from '../utils/apify.js';

const BUSY = JSON.stringify({ error: { type: 'concurrent-runs-limit-exceeded', message: 'By launching this job you will exceed your limit of 5 concurrent Actor runs.' } });

const reply = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(body),
    text: async () => body,
});

describe('runActor', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubEnv('APIFY_TOKEN', 'token');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('waits for a free run slot and then succeeds', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce(reply(402, BUSY))
            .mockResolvedValueOnce(reply(402, BUSY))
            .mockResolvedValueOnce(reply(201, '[{"markdown":"page"}]'));
        vi.stubGlobal('fetch', fetch);

        const run = runActor('actor', { url: 'u' }, { timeout: 60, memory: 512 });
        await vi.advanceTimersByTimeAsync(60_000);

        expect(await run).toEqual([{ markdown: 'page' }]);
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('gives up once it has waited two minutes', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(402, BUSY)));

        const run = runActor('actor', {}, { timeout: 60, memory: 512 });
        const failed = expect(run).rejects.toThrow(/Apify API error 402: .*concurrent-runs-limit-exceeded/);
        await vi.advanceTimersByTimeAsync(200_000);

        await failed;
    });

    it('fails at once on any other refusal', async () => {
        const fetch = vi.fn().mockResolvedValue(reply(402, '{"error":{"type":"not-enough-usage-to-run-paid-actor"}}'));
        vi.stubGlobal('fetch', fetch);

        await expect(runActor('actor', {}, { timeout: 60, memory: 512 })).rejects.toThrow(/not-enough-usage/);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
