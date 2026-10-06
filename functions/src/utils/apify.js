/**
 * How long a call waits for one of the account's concurrent run slots before
 * giving up. The free plan allows five Actor runs at once, and the hourly
 * scrape alone runs five; a discovery run then files up to ten candidates whose
 * tests all start together. Contention is the normal case, not an outage.
 */
const BUSY_WAIT_MS = 120_000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run an Apify Actor synchronously and return its dataset items, waiting for a
 * free run slot whenever Apify refuses the run for the account's concurrency
 * limit (HTTP 402, concurrent-runs-limit-exceeded). Any other refusal fails at
 * once.
 *
 * @param {string} actorId - e.g. 'apify~google-search-scraper'
 * @param {object} input - the Actor's input
 * @param {{timeout: number, memory: number}} run - Apify's own run limits (seconds, MB)
 * @returns {Promise<Array>}
 */
export async function runActor(actorId, input, { timeout, memory }) {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error('APIFY_TOKEN environment variable is not set');

    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items` +
        `?token=${token}&timeout=${timeout}&memory=${memory}`;
    const deadline = Date.now() + BUSY_WAIT_MS;

    for (;;) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });

        if (response.ok) return response.json();

        const body = await response.text();
        const busy = response.status === 402 && body.includes('concurrent-runs-limit-exceeded');

        if (!busy || Date.now() >= deadline) {
            throw new Error(`Apify API error ${response.status}: ${body.substring(0, 200)}`);
        }

        // Jittered, so runs refused together do not all retry together.
        await sleep(15_000 + Math.random() * 10_000);
    }
}
