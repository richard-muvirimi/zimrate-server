import { getFirestore } from 'firebase-admin/firestore';

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
    /** Bumped on every upload so cached images are re-fetched. */
    icon_version: 0,
    og_version: 0,
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
        icon_version: input.icon_version ?? current.icon_version,
        og_version: input.og_version ?? current.og_version,
        updated_at: new Date(),
    };

    await docRef().set(next, { merge: true });
    return next;
}

/**
 * Public shape. Object paths are fixed and overwritten in place, so these URLs
 * never change — which is what lets the og:image meta tag point at Storage
 * statically. `?v=` only busts caches.
 */
export function publicBranding(branding, bucket) {
    const base = `https://storage.googleapis.com/${bucket}`;
    return {
        app_name: branding.app_name,
        tagline: branding.tagline,
        author_name: branding.author_name,
        author_email: branding.author_email,
        author_url: branding.author_url,
        icon_url: `${base}/branding/app-icon.png?v=${branding.icon_version}`,
        og_image_url: `${base}/branding/og-image.png?v=${branding.og_version}`,
    };
}
