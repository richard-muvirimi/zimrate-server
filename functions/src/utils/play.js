import { GoogleAuth } from 'google-auth-library';

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/** Overridable so a test track or a renamed package does not need a code change. */
const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || 'com.tyganeutronics.myratecalculator';

/** purchaseState in the Play response. 1 is cancelled, 2 is pending payment. */
const STATE_PURCHASED = 0;

/**
 * Coins granted per product, before quantity.
 *
 * This is the authoritative copy. The app carries the same figures in BillingContract, but only
 * to label the buttons — what actually reaches a wallet is decided here, because a client that
 * can name its own reward is not a client that can be trusted with one.
 *
 * Kept as base + bonus the way the app writes it, so the two can be read side by side when a
 * pack changes. They have to be changed together.
 */
const COINS = {
    tiny_donation: 500 + 100,
    small_donation: 1000 + 200,
    medium_donation: 1500 + 500,
    large_donation: 2000 + 1000,
    huge_donation: 3000 + 1500,
    gigantic_donation: 5000 + 2000,
};

/** Lazily built: constructing it reads credentials, which a cold start should not pay for twice. */
let auth = null;

const client = () => (auth ??= new GoogleAuth({ scopes: [SCOPE] }));

/** @returns {number|null} coins for one unit of this product, or null if it is not a coin pack. */
export const coinsForProduct = (productId) => COINS[productId] ?? null;

export class PlayVerificationError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'PlayVerificationError';
        this.status = status;
    }
}

/**
 * Asks Google whether this purchase token is real, paid for, and for this product.
 *
 * Deliberately the REST endpoint over the `googleapis` package: this is one GET, and that package
 * is tens of megabytes of generated clients which every cold start would have to load.
 *
 * The service account the function runs as needs Android Publisher access, granted in Play
 * Console under Users and permissions. There is no key file — Application Default Credentials on
 * the function's own identity is the whole of it.
 *
 * @param productId {string}
 * @param purchaseToken {string}
 * @returns {Promise<{quantity: number, orderId: string|null, purchaseTimeMillis: number|null}>}
 * @throws {PlayVerificationError} when Play rejects the token or the purchase is not paid for.
 */
export const verifyProductPurchase = async (productId, purchaseToken) => {
    const url = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'
        + `/${encodeURIComponent(PACKAGE_NAME)}/purchases/products`
        + `/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

    let response;
    try {
        const accessToken = await client().getAccessToken();
        response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (err) {
        // Network trouble or a credential problem — not the caller's fault, and retrying later
        // may well work, so this must not read as "your purchase is invalid".
        throw new PlayVerificationError(`Could not reach Play: ${err.message}`, 503);
    }

    if (response.status === 404) {
        throw new PlayVerificationError('Play does not recognise this purchase', 400);
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new PlayVerificationError(
            `Play returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
            response.status >= 500 ? 503 : 502,
        );
    }

    const purchase = await response.json();

    if (purchase.purchaseState !== STATE_PURCHASED) {
        // A pending purchase is not paid for yet; Play hands it over again once it is.
        throw new PlayVerificationError('Purchase is not in a paid state', 409);
    }

    // consumptionState is deliberately not checked. A consumed token means the coins were already
    // handed over, and the ledger is what says so — rejecting here would break the legitimate
    // retry where the consume succeeded but our response never reached the handset.
    return {
        quantity: Number.isInteger(purchase.quantity) && purchase.quantity > 0
            ? purchase.quantity
            : 1,
        orderId: purchase.orderId ?? null,
        purchaseTimeMillis: Number(purchase.purchaseTimeMillis) || null,
    };
};
