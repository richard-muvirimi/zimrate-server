import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {logger} from "firebase-functions";

/**
 * Erases an account and everything held against it.
 *
 * This lives on the server rather than in the clients because the security rules do not permit a
 * client to do it. `users/$uid` has no top-level `.write`, and the rewards and spends rules carry
 * `newData.exists()` — the guard that stops somebody deleting a grant they have overdrawn. The
 * Admin SDK bypasses rules, so the guard can stay exactly as strict as it is while deletion still
 * works, and the app and the website share one implementation instead of two.
 *
 * Database first and auth second, deliberately. If the remove fails the user can still sign in and
 * ask again; the other order would leave a wallet under a uid that nobody can authenticate as, and
 * therefore nobody can ever clear.
 *
 * @param uid {string}
 * @returns {Promise<void>}
 */
export const deleteAccount = async (uid) => {
    await getDatabase().ref(`users/${uid}`).remove();
    await getAuth().deleteUser(uid);

    logger.log(`Deleted account ${uid} and its wallet.`);
};
