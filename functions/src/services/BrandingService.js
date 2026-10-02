import { getFirestore } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';

/**
 * Branding lives in Firestore at settings/branding, which firestore.rules
 * denies to every client — it is reachable only through the Admin SDK here.
 *
 * The public site cannot read it directly anyway: the landing bundle is
 * deliberately Firebase-free (that is what keeps the SDK off the public page),
 * so branding is served over GET /api/branding instead.
 */
const SETTINGS_COLLECTION = 'settings';
const BRANDING_DOC = 'branding';

const DEFAULTS = {
    app_name: 'ZimRate',
    tagline: 'Free, real-time Zimbabwe exchange rates',
    // Contact details shown in the footer, FAQ, privacy policy and contact page.
    // Previously hardcoded in seven places across four files.
    author_name: 'Richard Muvirimi',
    author_email: 'richard@tyganeutronics.com',
    author_url: 'https://richard.co.zw',
    // Drives both the footer link and the 'Fork me on GitHub' ribbon.
    repo_url: 'https://github.com/richard-muvirimi/zimrate-server',
};

function docRef() {
    return getFirestore().collection(SETTINGS_COLLECTION).doc(BRANDING_DOC);
}

export async function getBranding() {
    const snapshot = await docRef().get();
    if (!snapshot.exists) return { ...DEFAULTS };
    return { ...DEFAULTS, ...snapshot.data() };
}

export async function saveBranding(input) {
    const current = await getBranding();

    const next = {
        app_name: input.app_name ?? current.app_name,
        tagline: input.tagline ?? current.tagline,
        author_name: input.author_name ?? current.author_name,
        author_email: input.author_email ?? current.author_email,
        author_url: input.author_url ?? current.author_url,
        repo_url: input.repo_url ?? current.repo_url,
        updated_at: DateTime.now().toJSDate(),
    };

    await docRef().set(next, { merge: true });
    return next;
}

/**
 * Public shape. Object paths are fixed and overwritten in place, so these URLs
 * never change — which is what lets the og:image meta tag point at Storage
 * statically. Uploads are stored with Cache-Control: no-cache, so a replaced
 * image shows up without any cache-busting query.
 *
 * Firebase Storage URLs, not storage.googleapis.com: only these are governed by
 * storage.rules (public read on branding/). The GCS URL is gated by bucket IAM,
 * which is not public, so it returned 403 to every crawler and browser.
 */
export function publicBranding(branding, bucket) {
    const url = (path) =>
        `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
    return {
        app_name: branding.app_name,
        tagline: branding.tagline,
        author_name: branding.author_name,
        author_email: branding.author_email,
        author_url: branding.author_url,
        repo_url: branding.repo_url,
        icon_url: url('branding/app-icon.png'),
        og_image_url: url('branding/og-image.png'),
    };
}
