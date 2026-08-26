#!/usr/bin/env node
/**
 * Grants (or revokes) the `admin` custom claim on a Firebase Auth account.
 *
 * The admin API can already do this — POST /api/admin/users/:uid/claims — but
 * that endpoint itself requires an admin, so the *first* admin has to be set
 * out of band. That is what this script is for.
 *
 * Without the claim:
 *   - Firestore denies reads   -> "Missing or insufficient permissions"
 *   - /api/admin/** returns 403 -> "Admin access required"
 *
 * Usage:
 *   npm --prefix functions run set-admin -- you@example.com
 *   npm --prefix functions run set-admin -- you@example.com --revoke
 *
 * Credentials, either:
 *   gcloud auth application-default login
 *   # or
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const revoke = args.includes('--revoke');

if (!email) {
    console.error('Usage: npm --prefix functions run set-admin -- <email> [--revoke]');
    process.exit(1);
}

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
    const user = await getAuth().getUserByEmail(email);
    const existing = user.customClaims ?? {};

    await getAuth().setCustomUserClaims(user.uid, { ...existing, admin: !revoke });

    console.log(`${revoke ? 'Revoked' : 'Granted'} admin on ${email} (${user.uid}) in ${projectId}`);
    if (!user.emailVerified && !revoke) {
        console.warn('Note: this account has NOT verified its email — the admin UI will still block it.');
    }
    console.log('Sign out and back in so a fresh ID token picks up the claim.');
} catch (err) {
    console.error(`Failed: ${err.message}`);
    if (err.code === 'auth/user-not-found') {
        console.error('Create the account first (admin login screen, or the Firebase console).');
    }
    process.exit(1);
}
