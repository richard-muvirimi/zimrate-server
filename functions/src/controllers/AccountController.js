import { deleteAccount } from '../utils/account.js';

export class AccountController {
    /**
     * Deletes the calling user's own account.
     *
     * The uid is read from the verified token and from nowhere else — never a parameter or a body
     * field — so the endpoint has no target but its own caller and needs no authorisation check
     * beyond the one `verifyIdToken` already did.
     */
    static async deleteSelf(req, res, next) {
        try {
            await deleteAccount(req.user.uid);
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }
}
