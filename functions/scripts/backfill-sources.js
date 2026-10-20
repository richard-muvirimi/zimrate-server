#!/usr/bin/env node
/**
 * Gives every source the fields the admin Sources list queries on.
 *
 * That list now pages with Firestore cursors instead of loading every source, and
 * a Firestore query silently leaves out any document missing a field it orders or
 * filters by. Sources written before the list changed may lack:
 *   - name_lower — the sort order and the search
 *   - enabled    — the Enabled / Disabled filter; missing has always meant enabled
 *   - status     — the Scrape failing filter; missing has always meant failing
 *
 * New writes set all three (models/Source.js, the source form, candidate approval),
 * so this needs running once per project. Running it again changes nothing.
 *
 * Usage:
 *   npm --prefix functions run backfill-sources
 *
 * Credentials, either:
 *   gcloud auth application-default login
 *   # or
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

function resolveProjectId() {
    if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
    try {
        // Fall back to the project the repo is already pointed at.
        return JSON.parse(readFileSync(new URL('../../.firebaserc', import.meta.url), 'utf8'))
            .projects?.default;
    } catch {
        return undefined;
    }
}

const projectId = resolveProjectId();
if (!projectId) {
    console.error('Could not determine the project id. Set GCLOUD_PROJECT or add .firebaserc.');
    process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });

try {
    const db = getFirestore();
    const snap = await db.collection('sources').get();

    let batch = db.batch();
    let pending = 0;
    let updated = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const name = typeof data.name === 'string' ? data.name : '';
        const changes = {};
        if (data.name !== name) changes.name = name;
        if (data.name_lower !== name.toLowerCase()) changes.name_lower = name.toLowerCase();
        if (typeof data.enabled !== 'boolean') changes.enabled = true;
        if (typeof data.status !== 'boolean') changes.status = false;
        if (Object.keys(changes).length === 0) continue;

        batch.update(doc.ref, changes);
        updated++;
        // A batch takes at most 500 writes.
        if (++pending === 500) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
        }
    }
    if (pending > 0) await batch.commit();

    console.log(`Checked ${snap.size} source(s) in ${projectId}; updated ${updated}.`);
} catch (err) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
}
