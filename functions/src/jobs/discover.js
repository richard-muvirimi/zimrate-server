import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

// Weekly search for new candidate sources. Off unless discovery_enabled is
// 'true': every run spends Apify credit on the search and on vetting each new
// candidate, so it is opted into rather than out of.
export async function runScheduledDiscovery() {
    const { default: Option } = await import('../models/Option.js');
    if (await Option.getValue('discovery_enabled', 'false') !== 'true') {
        logger.log('[Discovery] Skipped: discovery_enabled is off');
        return;
    }

    const { DiscoveryService } = await import('../services/DiscoveryService.js');
    await DiscoveryService.discover();
}

// Runs on a new discovery_runs doc written by the admin Candidates page. A
// Firestore trigger rather than an /api endpoint for the same reason as
// testSource.js: Hosting cuts rewritten requests off at 60s.
export async function runDiscoveryRequest(event) {
    const doc = event.data;
    if (!doc) return;

    try {
        await doc.ref.update({ status: 'running' });

        const { DiscoveryService } = await import('../services/DiscoveryService.js');
        const result = await DiscoveryService.discover();

        await doc.ref.update({ status: 'done', ...result, finished_at: FieldValue.serverTimestamp() });
    } catch (err) {
        logger.error('Discovery run failed:', err);
        await doc.ref.update({ status: 'failed', error: err.message, finished_at: FieldValue.serverTimestamp() });
    }
}

// Every field a vetting writes, cleared first so a retest that fails early does
// not leave the previous test's findings showing beside its new error.
const UNTESTED = { error: null, javascript: null, page_date: null, rates: [] };

async function testCandidate(ref, url) {
    try {
        await ref.update({ ...UNTESTED, status: 'testing' });

        const { DiscoveryService } = await import('../services/DiscoveryService.js');
        const verdict = await DiscoveryService.vet(url);

        await ref.update({ ...verdict, tested_at: FieldValue.serverTimestamp() });
    } catch (err) {
        logger.error(`Candidate test failed for ${url}:`, err);
        await ref.update({ status: 'failed', error: err.message, tested_at: FieldValue.serverTimestamp() });
    }
}

// Runs on every new source_candidates doc filed by DiscoveryService.discover,
// vetting it in its own function instance so a run's candidates are tested in
// parallel and each gets the full timeout.
export async function runCandidateTest(event) {
    const doc = event.data;
    if (!doc) return;

    await testCandidate(doc.ref, doc.data().url);
}

// Runs on a new candidate_retests doc written by the Retest button: vets that
// candidate again, then deletes the request. Discovery never re-proposes a page
// it has listed, so a candidate whose test failed for a passing reason — Apify
// out of run slots, the site briefly down — is otherwise stuck as failed.
export async function runCandidateRetest(event) {
    const doc = event.data;
    if (!doc) return;

    const { candidate_id } = doc.data();
    const { DiscoveryService } = await import('../services/DiscoveryService.js');
    const candidate = await DiscoveryService.getCollection().doc(candidate_id).get();

    // Reviewed since the click, or deleted: nothing to retest.
    if (candidate.exists && ['passed', 'failed'].includes(candidate.data().status)) {
        await testCandidate(candidate.ref, candidate.data().url);
    }

    await doc.ref.delete();
}
