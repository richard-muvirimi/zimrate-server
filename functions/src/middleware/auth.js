import { getAuth } from 'firebase-admin/auth';
import { StatusCodes } from 'http-status-codes';

/**
 * Reads Bearer token from Authorization header, verifies it with Firebase Admin,
 * and attaches the decoded token to req.user.
 */
export async function verifyIdToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
            error: 'Missing or invalid Authorization header. Expected: Bearer <token>'
        });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (err) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
            error: 'Invalid or expired token',
            details: err.message
        });
    }
}

/**
 * Checks that req.user has the admin custom claim (admin: true).
 * Must run after verifyIdToken.
 */
export function requireAdmin(req, res, next) {
    if (!req.user || !req.user.admin) {
        return res.status(StatusCodes.FORBIDDEN).json({
            error: 'Admin access required'
        });
    }
    next();
}

/**
 * Combined middleware array for protecting admin endpoints.
 * Usage: router.get('/endpoint', ...adminAuth, handler)
 */
export const adminAuth = [verifyIdToken, requireAdmin];
