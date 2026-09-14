import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { StatusCodes } from 'http-status-codes';
import { readBalance, readWallet } from '../utils/wallet.js';

/** Page size for the app-user roster. Clamped so a caller cannot ask for the whole user base. */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Read-only views over the coin economy, for the admin dashboard.
 *
 * Kept apart from AdminController, which is about the things an admin edits — rates, sources,
 * console accounts. Nothing here writes: the economy is the app's to change, and this is the
 * window onto it.
 */
export class EconomyController {

    /**
     * The nightly snapshot written by the wallet sweep.
     *
     * Realtime Database has no aggregation, so these totals cannot be computed on demand without
     * reading every wallet in the project on every page load. They are therefore up to a day old,
     * and `computedAt` is returned so the dashboard can say so rather than implying live figures.
     */
    static async overview(_req, res, next) {
        try {
            const snapshot = await getDatabase().ref('stats/economy').get();

            if (!snapshot.exists()) {
                // The sweep runs nightly, so a fresh project has no snapshot until the first pass.
                // A 200 with an explicit null beats a 404 the dashboard would have to treat as an
                // error, because nothing is actually wrong.
                return res.json({ computedAt: null });
            }

            res.json(snapshot.val());
        } catch (err) {
            next(err);
        }
    }

    /**
     * One page of app users with their coin balance.
     *
     * Token paging rather than the whole list: every install creates an auth account, so this
     * list grows with the user base and the old approach of pulling up to five pages of a
     * thousand into the browser stopped being viable the moment the wallet moved to Firebase.
     *
     * The balance is a read per user, which is why the page size is capped.
     */
    static async listAppUsers(req, res, next) {
        try {
            const requested = Number.parseInt(req.query.limit, 10);
            const limit = Number.isFinite(requested)
                ? Math.min(Math.max(requested, 1), MAX_LIMIT)
                : DEFAULT_LIMIT;

            const page = await getAuth().listUsers(limit, req.query.pageToken || undefined);

            const users = await Promise.all(page.users.map(async user => ({
                uid: user.uid,
                email: user.email ?? null,
                displayName: user.displayName || null,
                // No provider means the account cannot be signed back into from anywhere else.
                anonymous: (user.providerData ?? []).length === 0,
                disabled: user.disabled,
                admin: user.customClaims?.admin === true,
                creationTime: user.metadata.creationTime,
                lastSignInTime: user.metadata.lastSignInTime || null,
                balance: await readBalance(user.uid),
            })));

            res.json({ users, nextPageToken: page.pageToken ?? null });
        } catch (err) {
            next(err);
        }
    }

    /**
     * One account's grants and spends — the view that answers "I bought coins and they are gone".
     */
    static async userWallet(req, res, next) {
        try {
            const { uid } = req.params;

            try {
                await getAuth().getUser(uid);
            } catch {
                return res.status(StatusCodes.NOT_FOUND).json({ error: 'User not found' });
            }

            res.json(await readWallet(uid));
        } catch (err) {
            next(err);
        }
    }
}
