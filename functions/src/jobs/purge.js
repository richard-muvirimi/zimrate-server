import { logger } from 'firebase-functions';
import { sweepWallets } from '../utils/wallet.js';

// Realtime Database has no TTL policy, so expired coin history is swept rather than expiring on
// its own. Deliberately its own function and not folded into the scrape tick: it walks every
// user, and a failure here should not be reported as a scraping failure.
//
// The same walk totals what survives into stats/economy, which is what the admin dashboard
// reads — there is no aggregation in Realtime Database, so the alternative would be summing
// every wallet on every dashboard load.
//
// Nightly is ample — purgeAt sits six months past a row's expiry, so a day either way is noise,
// and the dashboard is an overview rather than a live ledger.
export async function runPurge() {
    try {
        const {removed, stats} = await sweepWallets();
        logger.log(`Wallet sweep removed ${removed} rows across ${stats.users} accounts.`);
    } catch (err) {
        logger.error('Wallet sweep failed:', err);
    }
}
