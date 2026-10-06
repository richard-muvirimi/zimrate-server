import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import _ from 'lodash';

// Runs on a new source_scrapes doc written by the admin Sources page, to scrape
// one source now rather than at the next hourly run. A Firestore trigger rather
// than an /api endpoint for the same reason as testSource.js: Hosting cuts
// rewritten requests off at 60s, and a browser-rendered scrape runs longer.
export async function runSourceScrape(event) {
    const doc = event.data;
    if (!doc) return;

    const { source_id } = doc.data();

    try {
        await doc.ref.update({ status: 'running' });

        const [{ ScrapingService }, { default: Source }] = await Promise.all([
            import('../services/ScrapingService.js'),
            import('../models/Source.js'),
        ]);

        const source = await Source.findById(source_id);
        if (!source) throw new Error('Source not found');
        // Its rates would be published even though the hourly run skips it.
        if (!source.enabled) throw new Error('Source is disabled; enable it before scraping');

        const results = await ScrapingService.scrapeSource(source);

        await doc.ref.update({
            status: 'done',
            counts: _.countBy(results, 'action'),
            finished_at: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        logger.error(`Source scrape failed for ${source_id}:`, err);
        await doc.ref.update({ status: 'failed', error: err.message, finished_at: FieldValue.serverTimestamp() });
    }
}
