import crypto from 'crypto';

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

/** Rotates the derived session id; GA4's own web sessions time out at 30 min. */
const SESSION_WINDOW_MS = 30 * 60 * 1000;

/**
 * Salt for the caller hash. Without one the hash is not protective: the whole
 * IPv4 space is ~4 billion values, so an unsalted digest is reversible by brute
 * force in minutes.
 *
 * Falling back to a per-instance random value means a cold start splits one
 * caller into two — it over-counts rather than leaking, which is the safer way
 * to be wrong.
 */
const CLIENT_ID_SALT = process.env.ANALYTICS_SALT || crypto.randomBytes(16).toString('hex');

/**
 * Every segment that appears literally in the route table. Anything else is a
 * document id — or a probe from a scanner, which a public API gets plenty of.
 *
 * Collapsing those keeps the endpoint dimension bounded: GA4 buckets a
 * dimension into "(other)" past 500 distinct values in a day, at which point
 * the real endpoints stop being distinguishable.
 */
const ROUTE_SEGMENTS = new Set([
    'v1', 'v2', 'branding', 'contact', 'graphql', 'admin', 'users', 'sources',
    'rates', 'scrape', 'smtp', 'test', 'export', 'import', 'claims',
]);

/** '/admin/users/x7Kd2' -> '/api/admin/users/{id}' */
function normaliseEndpoint(path) {
    const parts = path
        .split('/')
        .filter(Boolean)
        .map((segment) => {
            const lower = segment.toLowerCase();
            return ROUTE_SEGMENTS.has(lower) ? lower : '{id}';
        });
    return parts.length ? `/api/${parts.join('/')}` : '/api';
}

/**
 * Express middleware that logs each API request to GA4 via the Measurement
 * Protocol. Fires and forgets — never delays or fails the request.
 *
 * Derived from the legacy Laravel LogApiAnalytics middleware, but deliberately
 * no longer a mirror of it: that one sent the caller's raw IP as the client id,
 * set user_id for anonymous callers, and reported every API call as a page_view.
 *
 * Sent during the request rather than on res 'finish'. That costs the response
 * status and the matched route pattern, but a Cloud Functions instance can be
 * frozen once the response is sent, so work deferred to 'finish' may never run.
 */
export const logAnalytics = (req, res, next) => {
    const measurementId = process.env.MEASUREMENT_ID;
    const apiSecret = process.env.MEASUREMENT_PROTOCOL_API_SECRET;

    if (measurementId && apiSecret) {
        const ip = req.ip || req.headers['x-forwarded-for'] || '';
        const userAgent = req.headers['user-agent'] || 'Zimrate/1.0';

        // Pseudonymous and stable per caller. The raw IP must never be sent:
        // Google's Measurement Protocol policy forbids uploading PII, and an IP
        // counts as personal data under GDPR.
        const clientId = crypto
            .createHash('sha256')
            .update(CLIENT_ID_SALT + ip + userAgent)
            .digest('hex')
            .slice(0, 32);

        // Same identity, bucketed into windows, so sessions expire instead of
        // every caller having one session that never ends.
        const sessionId = `${clientId.slice(0, 16)}.${Math.floor(Date.now() / SESSION_WINDOW_MS)}`;

        const payload = {
            // No user_id: that field means a known, signed-in person, and this
            // API has no accounts. Populating it with a derived value would
            // report anonymous callers as identified users.
            client_id: clientId,
            // One custom event, no page_view. An API call is not a page view:
            // emitting one puts REST endpoints into the Pages reports, where
            // they inflate pageview counts and sit alongside real site pages.
            // The endpoint belongs in its own dimension instead.
            events: [
                {
                    name: 'api_request',
                    params: {
                        // Without session_id and engagement_time_msec GA4 leaves
                        // the event out of session-scoped and realtime reports.
                        session_id: sessionId,
                        engagement_time_msec: '100',
                        endpoint: normaliseEndpoint(req.path),
                        method: req.method,
                        language: req.acceptsLanguages()[0] || 'en',
                    }
                }
            ]
        };

        fetch(`${GA4_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }).catch(() => {}); // fire and forget — never block the request
    }

    next();
};
