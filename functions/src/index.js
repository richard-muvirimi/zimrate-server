import express from 'express';
import 'dotenv/config';
import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import apiRoutes from './routes/api.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { logAnalytics } from './middleware/analytics.js';
import cors from 'cors';
import Option from './models/Option.js';
import { hasCache, setCache, cleanCache } from './utils/cache.js';
import { purgeExpiredWallets } from './utils/wallet.js';
import { DateTime } from 'luxon';

const app = express();

setGlobalOptions({ maxInstances: 5, memory: '256MiB' });

initializeApp();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // increased for import payloads
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', logAnalytics, apiRoutes);

// Error handling middleware
app.use(errorHandler);
app.use(notFoundHandler);

// ── Main HTTP function ────────────────────────────────────────────────────────
// timeoutSeconds 300: scrape endpoint calls Apify (~60s) + DeepSeek (~15s) + Firestore
export const zimrate_app = onRequest({ timeoutSeconds: 300, memory: '512MiB', region: 'us-central1' }, app);

// ── Scheduled scraping function ───────────────────────────────────────────────
// Runs every minute but scraping is throttled to once per hour via cache lock.
// Deleting the 'scrape_lock' cache key triggers an early scrape on the next tick.
export const zimrate_scrape = onSchedule({
    schedule: '* * * * *',
    region: 'us-central1', // Cloud Scheduler is not available in africa-south1
    memory: '512MiB',
    timeoutSeconds: 540,
}, async () => {
    try {
        // Allow disabling scraping without redeployment via options doc
        const scrapingEnabled = await Option.getValue('scraping_enabled', 'true');
        if (scrapingEnabled === 'false') {
            logger.log('Scraping is disabled via options. Skipping.');
            return;
        }

        // Skip if lock is still active (scraped within the last hour)
        if (await hasCache('scrape_lock')) {
            logger.log('Scrape lock active — skipping this tick.');
            return;
        }

        // Claim the lock until the top of the next hour so scraping stays
        // anchored to the clock regardless of when within the hour it ran.
        await setCache('scrape_lock', true, DateTime.now().plus({ hours: 1 }).startOf('hour'));

        const { ScrapingService } = await import('./services/ScrapingService.js');
        await Promise.all([
            ScrapingService.scrapeAll(),
            cleanCache()
        ]);
    } catch (err) {
        logger.error('Scheduled scraping failed:', err);
    }
});

// ── Wallet retention ──────────────────────────────────────────────────────────
// Realtime Database has no TTL policy, so expired coin history is swept rather than expiring on
// its own. Deliberately its own function and not folded into the scrape tick: it walks every
// user, and a failure here should not be reported as a scraping failure.
//
// Nightly is ample — purgeAt sits six months past a row's expiry, so a day either way is noise.
export const zimrate_purge = onSchedule({
    schedule: '17 3 * * *',
    timeZone: 'Africa/Harare',
    region: 'us-central1', // Cloud Scheduler is not available in africa-south1
    memory: '512MiB',
    timeoutSeconds: 540,
}, async () => {
    try {
        const removed = await purgeExpiredWallets();
        logger.log(`Wallet purge removed ${removed} rows.`);
    } catch (err) {
        logger.error('Wallet purge failed:', err);
    }
});
