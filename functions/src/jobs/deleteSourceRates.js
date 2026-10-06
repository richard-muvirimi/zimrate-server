import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

// Runs when a source document is deleted, from the admin Sources page or the
// API alike, and deletes the rates it produced. Left behind, they were never
// served again (Rate.fromServedSource), but nothing else would ever delete
// them either: the retention sweep only runs while their source is scraped.
export async function runSourceRatesDelete(event) {
    const sourceId = event.params.sourceId;
    const db = getFirestore();

    const snap = await db.collection('rates').where('source_id', '==', sourceId).get();

    for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = db.batch();
        snap.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    logger.log(`[Sources] Deleted ${snap.size} rate(s) of deleted source ${sourceId}`);
}
