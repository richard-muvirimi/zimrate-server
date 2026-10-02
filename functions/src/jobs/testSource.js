import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

// Runs on a new source_tests doc written by the admin source form. A Firestore
// trigger rather than an /api endpoint because Hosting cuts rewritten requests
// off at 60s, and a test that falls back to browser rendering runs longer.
export async function runSourceTest(event) {
    const doc = event.data;
    if (!doc) return;

    const { url } = doc.data();

    try {
        await doc.ref.update({ status: 'running' });

        const { ScrapingService } = await import('../services/ScrapingService.js');
        const result = await ScrapingService.testSource(url);

        await doc.ref.update({ status: 'done', ...result, finished_at: FieldValue.serverTimestamp() });
    } catch (err) {
        logger.error(`Source test failed for ${url}:`, err);
        await doc.ref.update({ status: 'failed', error: err.message, finished_at: FieldValue.serverTimestamp() });
    }
}
