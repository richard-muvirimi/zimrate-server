import { logger } from 'firebase-functions';
import { DateTime } from 'luxon';
import Option from '../models/Option.js';
import { hasCache, setCache, cleanCache } from '../utils/cache.js';

// Runs every minute but scraping is throttled to once per hour via cache lock.
// Deleting the 'scrape_lock' cache key triggers an early scrape on the next tick.
export async function runScrape() {
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

        const { ScrapingService } = await import('../services/ScrapingService.js');
        await Promise.all([
            ScrapingService.scrapeAll(),
            cleanCache()
        ]);
    } catch (err) {
        logger.error('Scheduled scraping failed:', err);
    }
}
