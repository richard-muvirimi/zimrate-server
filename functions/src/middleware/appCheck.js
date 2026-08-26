import { getAppCheck } from 'firebase-admin/app-check';
import { StatusCodes } from 'http-status-codes';

const HEADER = 'x-firebase-appcheck';

/**
 * App Check cannot be enforced at the function level: `zimrate_app` also serves
 * the public REST and GraphQL endpoints, and /api, /api/v1 and /api/v2 support
 * JSONP — a <script src="..."> request cannot send a custom header at all.
 * So enforcement lives here, mounted only on the admin sub-router.
 */

function enforcementEnabled() {
    // Soft by default. Deploy with APPCHECK_ENFORCE unset, confirm tokens are
    // arriving in the logs, then flip it — otherwise a hosting/functions deploy
    // skew locks every admin out.
    if (process.env.FUNCTIONS_EMULATOR === 'true') return false;
    return process.env.APPCHECK_ENFORCE === 'true';
}

/**
 * Verifies the App Check token on admin requests.
 * In soft mode it still verifies and logs, but never blocks.
 */
export async function verifyAppCheck(req, res, next) {
    const token = req.header(HEADER);
    const enforcing = enforcementEnabled();

    if (!token) {
        if (!enforcing) {
            console.warn('[appCheck] missing token (soft mode, allowing)', req.path);
            req.appCheck = { verified: false };
            return next();
        }
        return res.status(StatusCodes.UNAUTHORIZED).json({
            error: 'Missing App Check token'
        });
    }

    try {
        // Plain verifyToken, not { consume: true } — consumption requires replay
        // protection to be enabled and breaks parallel requests.
        await getAppCheck().verifyToken(token);
        req.appCheck = { verified: true };
        next();
    } catch (err) {
        if (!enforcing) {
            console.warn('[appCheck] invalid token (soft mode, allowing):', err.message);
            req.appCheck = { verified: false };
            return next();
        }
        return res.status(StatusCodes.FORBIDDEN).json({
            error: 'Invalid App Check token'
        });
    }
}

/**
 * Never blocks. Records whether a valid App Check token was present so
 * downstream code (e.g. GraphQL resolvers) can treat verified traffic
 * differently without shutting out third-party API consumers.
 */
export async function optionalAppCheck(req, _res, next) {
    const token = req.header(HEADER);
    if (!token) {
        req.appCheck = { verified: false };
        return next();
    }
    try {
        await getAppCheck().verifyToken(token);
        req.appCheck = { verified: true };
    } catch {
        req.appCheck = { verified: false };
    }
    next();
}
