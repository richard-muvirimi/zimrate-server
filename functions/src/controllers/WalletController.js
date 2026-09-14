import { createHash } from 'node:crypto';
import { getDatabase } from 'firebase-admin/database';
import { StatusCodes } from 'http-status-codes';
import { logger } from 'firebase-functions';
import { DateTime } from 'luxon';
import { coinsForProduct, verifyProductPurchase, PlayVerificationError } from '../utils/play.js';

/**
 * How long purchased coins last. Mirrors `reward_purchase_days` in the app's Remote Config
 * defaults — the two have to be changed together, because Remote Config is evaluated on the
 * handset and this grant is written here.
 */
const PURCHASE_DAYS = 200;

/** Matches WalletContract.RETENTION_DAYS: history outlives expiry by six months. */
const RETENTION_DAYS = 183;

/** The rules cap descriptions at 200 characters; anything longer is a client bug, not a reason to fail. */
const MAX_DESCRIPTION = 200;

export class WalletController {

    /**
     * Credits a coin purchase, after checking with Google that it happened.
     *
     * The handset used to write this grant itself. It cannot be allowed to: the row it wrote named
     * its own amount, so anybody able to reach the database with their own ID token could mint
     * coins without paying. Verification has to happen somewhere the user does not control, and
     * the Admin SDK bypasses the rules, so the rules can forbid clients writing purchase rows at
     * all while this still works.
     *
     * Safe to call repeatedly with the same token, which matters because the app retries: Play
     * re-delivers an unconsumed purchase on every query, so a credit whose response was lost comes
     * back around rather than being dropped.
     */
    static async creditPurchase(req, res, next) {
        try {
            const uid = req.user.uid;

            // The app already gates the purchase button on being signed in. Enforced again here
            // because an anonymous account cannot be recovered, and coins somebody paid for must
            // not be tied to one that cannot be signed back into.
            if (req.user.firebase?.sign_in_provider === 'anonymous') {
                return res.status(StatusCodes.FORBIDDEN).json({
                    error: 'Sign in with Google or email before buying coins'
                });
            }

            const { productId, purchaseToken, description } = req.body ?? {};

            if (typeof productId !== 'string' || typeof purchaseToken !== 'string'
                || !productId || !purchaseToken) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'productId and purchaseToken are required'
                });
            }

            const perUnit = coinsForProduct(productId);
            if (perUnit === null) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Unknown product'
                });
            }

            const key = purchaseKey(purchaseToken);
            const db = getDatabase();

            // One ledger entry per purchase token, across all accounts. Without it a token could
            // be replayed under a second uid — the per-user grant key alone would not collide, so
            // one payment would credit two wallets.
            const existing = await db.ref(`purchases/${key}`).get();
            if (existing.exists()) {
                const owner = existing.val()?.uid;
                if (owner !== uid) {
                    logger.warn(`Purchase ${key} already credited to ${owner}, refused for ${uid}`);
                    return res.status(StatusCodes.CONFLICT).json({
                        error: 'This purchase has already been credited to another account'
                    });
                }

                // The same account asking again — the retry path, and not an error.
                return res.json({ credited: false, alreadyCredited: true, coins: existing.val()?.coins ?? 0 });
            }

            const purchase = await verifyProductPurchase(productId, purchaseToken);
            const coins = perUnit * purchase.quantity;

            const now = DateTime.utc();
            const expiresAt = now.plus({ days: PURCHASE_DAYS + 1 }).startOf('day').minus({ seconds: 1 });

            const reward = {
                amount: coins,
                balance: coins,
                type: 'purchase',
                // Display text only, so taking the client's localised string is safe — nothing is
                // computed from it. Clamped because the rules reject anything longer.
                description: typeof description === 'string' && description
                    ? description.slice(0, MAX_DESCRIPTION)
                    : `Coin Purchase. ${coins} coins have been credited.`,
                createdAt: Math.floor(now.toSeconds()),
                expiresAt: Math.floor(expiresAt.toSeconds()),
                purgeAt: Math.floor(expiresAt.plus({ days: RETENTION_DAYS }).toSeconds()),
            };

            // One atomic multi-path write: the ledger entry that stops a replay and the grant it
            // authorises land together or not at all.
            await db.ref().update({
                [`purchases/${key}`]: {
                    uid,
                    productId,
                    coins,
                    quantity: purchase.quantity,
                    orderId: purchase.orderId,
                    creditedAt: Math.floor(now.toSeconds()),
                },
                [`users/${uid}/rewards/${key}`]: reward,
            });

            logger.log(`Credited ${coins} coins to ${uid} for ${productId} (${key}).`);

            res.status(StatusCodes.CREATED).json({ credited: true, coins });
        } catch (err) {
            if (err instanceof PlayVerificationError) {
                return res.status(err.status).json({ error: err.message });
            }
            next(err);
        }
    }
}

/**
 * A database key derived from the purchase token.
 *
 * Same derivation the app used when it wrote these rows itself — SHA-256, first sixteen bytes,
 * hex — so grants written before and after this endpoint existed share one key space and a
 * purchase cannot be credited once by each.
 *
 * Hex because a Realtime Database key cannot contain `.` `$` `#` `[` `]` or `/`, and a raw Play
 * token can.
 */
const purchaseKey = (purchaseToken) =>
    'p_' + createHash('sha256').update(purchaseToken, 'utf8').digest('hex').slice(0, 32);
