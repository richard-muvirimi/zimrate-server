import { getAuth } from 'firebase-admin/auth';
import { StatusCodes } from 'http-status-codes';
import Source from '../models/Source.js';
import Rate from '../models/Rate.js';
import Option from '../models/Option.js';
import { DateTime } from 'luxon';
import _ from 'lodash';
import { deleteCache } from '../utils/cache.js';
import { deleteAccount } from '../utils/account.js';

const ROSTER_DEFAULT_LIMIT = 25;
const ROSTER_MAX_LIMIT = 100;
const ROSTER_MAX_BATCHES = 50;

export class AdminController {

    // =========================================================================
    // USER MANAGEMENT
    // =========================================================================

    /**
     * The console roster: accounts that can actually sign in here, a page at a time.
     *
     * Anonymous accounts are dropped. Every app install creates one, so they now outnumber the
     * people running the console by orders of magnitude, and leaving them in buried the admins in
     * a list that also could not be paged. They have their own page — see EconomyController.
     *
     * Filtered here rather than in the browser because `listUsers` returns accounts in uid order
     * and filters nothing: an admin can sit anywhere in that sequence. So the walk goes through
     * Auth only as far as it takes to fill one page, plus one match to know there is another,
     * and hands back where it stopped as `nextPageToken` — the Auth page it was reading and the
     * position in it. Forward only, like the app-users list, and for the same reason.
     *
     * Query: `limit`, `pageToken`, `search` (in the name or email), `role` (admin, standard,
     * disabled).
     */
    static async listUsers(req, res, next) {
        try {
            const requested = Number.parseInt(req.query.limit, 10);
            const limit = Number.isFinite(requested)
                ? Math.min(Math.max(requested, 1), ROSTER_MAX_LIMIT)
                : ROSTER_DEFAULT_LIMIT;
            const term = String(req.query.search ?? '').trim().toLowerCase();
            const role = String(req.query.role ?? '');

            let position = { t: undefined, i: 0 };
            if (req.query.pageToken) {
                try {
                    position = JSON.parse(Buffer.from(String(req.query.pageToken), 'base64url').toString());
                } catch {
                    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid pageToken' });
                }
            }

            const matches = (u) => {
                if ((u.providerData ?? []).length === 0) return false;
                const isAdmin = u.customClaims?.admin === true;
                if (role === 'admin' && !isAdmin) return false;
                if (role === 'standard' && isAdmin) return false;
                if (role === 'disabled' && !u.disabled) return false;
                return !term
                    || (u.email ?? '').toLowerCase().includes(term)
                    || (u.displayName ?? '').toLowerCase().includes(term);
            };

            // listUsers caps at 1000 per call. The batch cap keeps one request bounded; a walk
            // that reaches it without filling the page still hands back where it got to.
            const collected = [];
            let resume = null;
            let { t, i } = position;
            for (let batches = 0; batches < ROSTER_MAX_BATCHES && !resume; batches++) {
                const batch = await getAuth().listUsers(1000, t || undefined);
                for (; i < batch.users.length; i++) {
                    if (!matches(batch.users[i])) continue;
                    if (collected.length === limit) {
                        resume = { t, i };
                        break;
                    }
                    collected.push(batch.users[i]);
                }
                if (resume || !batch.pageToken) break;
                t = batch.pageToken;
                i = 0;
                if (batches === ROSTER_MAX_BATCHES - 1) resume = { t, i };
            }

            const users = collected.map(u => ({
                uid: u.uid,
                email: u.email,
                displayName: u.displayName || null,
                photoURL: u.photoURL || null,
                disabled: u.disabled,
                emailVerified: u.emailVerified,
                customClaims: u.customClaims || {},
                metadata: {
                    creationTime: u.metadata.creationTime,
                    lastSignInTime: u.metadata.lastSignInTime || null
                },
                providerData: u.providerData || []
            }));
            res.json({
                users,
                nextPageToken: resume ? Buffer.from(JSON.stringify(resume)).toString('base64url') : null,
            });
        } catch (err) {
            next(err);
        }
    }

    static async createUser(req, res, next) {
        try {
            // Account creation is gated by an option, not just by the admin
            // claim. An admin account that is compromised — or one that should
            // no longer be adding people — cannot mint new accounts while this
            // is off. Enforced here rather than only in the UI, so it holds for
            // direct API calls too.
            const registrationEnabled = await Option.getValue('registration_enabled', 'true');
            if (registrationEnabled === 'false') {
                return res.status(StatusCodes.FORBIDDEN).json({
                    error: 'Account registration is disabled. Enable it in Options to add users.'
                });
            }

            const { email, password, displayName } = req.body;
            if (!email || !password) {
                return res.status(StatusCodes.BAD_REQUEST).json({ error: 'email and password are required' });
            }

            const user = await getAuth().createUser({
                email,
                password,
                displayName: displayName || undefined,
                emailVerified: false
            });

            res.status(StatusCodes.CREATED).json({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || null
            });
        } catch (err) {
            next(err);
        }
    }

    static async updateUser(req, res, next) {
        try {
            const { uid } = req.params;
            const { displayName, disabled, photoURL } = req.body;

            const updates = {};
            if (displayName !== undefined) updates.displayName = displayName;
            if (disabled !== undefined) updates.disabled = disabled;
            // Avatars are uploaded to Storage by the admin UI, which then sends
            // the resulting URL here. listUsers already returns photoURL.
            if (photoURL !== undefined) updates.photoURL = photoURL || null;

            await getAuth().updateUser(uid, updates);
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    static async deleteUser(req, res, next) {
        try {
            const { uid } = req.params;
            // Prevent self-deletion
            if (uid === req.user.uid) {
                return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Cannot delete your own account' });
            }
            // Same helper the self-service route uses, so an admin deletion also takes the
            // wallet with it. Calling deleteUser alone left users/{uid} orphaned in the
            // database with nobody able to authenticate as it and clear it.
            await deleteAccount(uid);
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    static async setUserClaims(req, res, next) {
        try {
            const { uid } = req.params;
            const { admin } = req.body;

            if (typeof admin !== 'boolean') {
                return res.status(StatusCodes.BAD_REQUEST).json({ error: 'admin must be a boolean' });
            }

            await getAuth().setCustomUserClaims(uid, { admin });
            res.json({ success: true, uid, admin });
        } catch (err) {
            next(err);
        }
    }

    // =========================================================================
    // SOURCE MANAGEMENT
    // =========================================================================

    static async listSources(_req, res, next) {
        try {
            const sources = await Source.findAll();
            res.json(sources);
        } catch (err) {
            next(err);
        }
    }

    static async createSource(req, res, next) {
        try {
            const { name, url, enabled, javascript } = req.body;
            if (!name || !url) {
                return res.status(StatusCodes.BAD_REQUEST).json({ error: 'name and url are required' });
            }

            const source = new Source({
                name,
                url,
                enabled: enabled !== undefined ? !!enabled : true,
                javascript: !!javascript,
                status: false,
                status_message: ''
            });
            await source.save();
            res.status(StatusCodes.CREATED).json(source);
        } catch (err) {
            next(err);
        }
    }

    static async getSource(req, res, next) {
        try {
            const source = await Source.findById(req.params.id);
            if (!source) {
                return res.status(StatusCodes.NOT_FOUND).json({ error: 'Source not found' });
            }
            res.json(source);
        } catch (err) {
            next(err);
        }
    }

    static async updateSource(req, res, next) {
        try {
            const source = await Source.findById(req.params.id);
            if (!source) {
                return res.status(StatusCodes.NOT_FOUND).json({ error: 'Source not found' });
            }

            const { name, url, enabled, javascript } = req.body;
            if (name !== undefined) source.name = name;
            if (url !== undefined) source.url = url;
            if (enabled !== undefined) source.enabled = !!enabled;
            if (javascript !== undefined) source.javascript = !!javascript;

            await source.save();
            res.json(source);
        } catch (err) {
            next(err);
        }
    }

    static async deleteSource(req, res, next) {
        try {
            const { id } = req.params;
            const source = await Source.findById(id);
            if (!source) {
                return res.status(StatusCodes.NOT_FOUND).json({ error: 'Source not found' });
            }

            await Source.getCollection().doc(id).delete();
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    static async triggerScrape(_req, res, next) {
        try {
            // Delete the scrape lock so the next cron tick (within 1 minute) runs scrapeAll()
            await deleteCache('scrape_lock');
            res.json({ success: true, message: 'Scrape scheduled — will run within 1 minute.' });
        } catch (err) {
            next(err);
        }
    }

    // =========================================================================
    // RATE MANAGEMENT (admin view — all rates including disabled)
    // =========================================================================

    static async updateRate(req, res, next) {
        try {
            const snapshot = await Rate.getCollection().doc(req.params.id).get();
            if (!snapshot.exists) {
                return res.status(StatusCodes.NOT_FOUND).json({ error: 'Rate not found' });
            }

            const rate = Rate.fromFirestore(snapshot);
            const allowedFields = [
                'rate_name', 'rate_currency',
                'rate', 'last_rate', 'enabled'
            ];

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) rate[field] = req.body[field];
            });

            await rate.save();
            res.json(rate);
        } catch (err) {
            next(err);
        }
    }

    static async deleteRate(req, res, next) {
        try {
            const doc = await Rate.getCollection().doc(req.params.id).get();
            if (!doc.exists) {
                return res.status(StatusCodes.NOT_FOUND).json({ error: 'Rate not found' });
            }
            await Rate.getCollection().doc(req.params.id).delete();
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    // =========================================================================
    // IMPORT / EXPORT
    // =========================================================================

    /**
     * POST /api/admin/import
     * Accepts a JSON array of phpMyAdmin-exported MySQL rows.
     * Groups by source_url → creates Sources → creates/updates Rates.
     */
    static async importData(req, res, next) {
        try {
            let rows = req.body;

            if (!Array.isArray(rows)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Request body must be a JSON array of rate rows'
                });
            }

            const results = { created: 0, updated: 0, sources_created: 0, errors: [] };
            const sourceMap = new Map(); // url → source.id

            // ---- Step 1: Create/find sources grouped by source_url ----
            const urlGroups = _.groupBy(rows, 'source_url');

            for (const [url, urlRows] of Object.entries(urlGroups)) {
                if (!url) continue;

                let source = await Source.findByUrl(url);
                if (!source) {
                    const firstRow = urlRows[0];
                    source = new Source({
                        name: firstRow.rate_name || url,
                        url,
                        enabled: firstRow.enabled == 1,
                        javascript: firstRow.javascript == 1,
                        status: firstRow.status == 1,
                        status_message: firstRow.status_message || ''
                    });
                    await source.save();
                    results.sources_created++;
                }

                sourceMap.set(url, source.id);
            }

            // ---- Step 2: Create/update rates ----
            for (const row of rows) {
                try {
                    const sourceId = sourceMap.get(row.source_url);
                    const currency = (row.rate_currency || '').toUpperCase();

                    if (!currency || !row.source_url) {
                        results.errors.push({ row: row.id, error: 'Missing rate_currency or source_url' });
                        continue;
                    }

                    // Find existing rate by source_id + currency
                    const existing = await Rate.getCollection()
                        .where('source_id', '==', sourceId)
                        .where('rate_currency', '==', currency)
                        .limit(1)
                        .get();

                    const rateData = {
                        rate_name: row.rate_name || `${currency} Rate`,
                        rate_currency: currency,
                        source_url: row.source_url,
                        source_id: sourceId,
                        rate: parseFloat(row.rate) || 0,
                        last_rate: parseFloat(row.last_rate) || 0,
                        status: row.status == 1,
                        enabled: row.enabled == 1,
                        status_message: row.status_message || '',
                        rate_updated_at: row.rate_updated_at ? DateTime.fromSQL(row.rate_updated_at).toJSDate() : null,
                        created_at: row.created_at ? DateTime.fromSQL(row.created_at).toJSDate() : DateTime.now().toJSDate(),
                        updated_at: row.updated_at ? DateTime.fromSQL(row.updated_at).toJSDate() : DateTime.now().toJSDate()
                    };

                    if (existing.empty) {
                        const rate = new Rate(rateData);
                        await rate.save();
                        results.created++;
                    } else {
                        const rate = new Rate({ id: existing.docs[0].id, ...rateData });
                        await rate.save();
                        results.updated++;
                    }
                } catch (rowErr) {
                    results.errors.push({ row: row.id, error: rowErr.message });
                }
            }

            res.json(results);
        } catch (err) {
            next(err);
        }
    }

    /**
     * GET /api/admin/export
     * Exports Firestore data as phpMyAdmin-compatible JSON array.
     */
    static async exportData(_req, res, next) {
        try {
            const [ratesSnap, sourcesSnap] = await Promise.all([
                Rate.getCollection().get(),
                Source.getCollection().get()
            ]);

            const sourcesMap = new Map(
                sourcesSnap.docs.map(d => [d.id, d.data()])
            );

            const rows = ratesSnap.docs.map(doc => {
                const r = Rate.fromFirestore(doc);
                const source = sourcesMap.get(r.source_id) || {};

                const toMysqlDatetime = (val) => {
                    if (!val) return null;
                    return (val instanceof Date ? DateTime.fromJSDate(val) : DateTime.fromISO(val))
                        .toFormat('yyyy-MM-dd HH:mm:ss');
                };

                return {
                    id: null, // MySQL ID not preserved — signals new insert on re-import
                    // status and status_message live on the source, not the rate, and
                    // that is where importData reads them back into — same as javascript.
                    status: source.status ? 1 : 0,
                    enabled: r.enabled ? 1 : 0,
                    javascript: source.javascript ? 1 : 0,
                    rate_name: r.rate_name,
                    rate_currency: r.rate_currency,
                    source_url: r.source_url,
                    rate_selector: '',
                    selector_type: 'css',
                    rate_updated_at_selector: '',
                    rate: r.rate,
                    last_rate: r.last_rate,
                    source_timezone: 'UTC',
                    rate_updated_at: toMysqlDatetime(r.rate_updated_at),
                    status_message: source.status_message || '',
                    updated_at: toMysqlDatetime(r.updated_at),
                    created_at: toMysqlDatetime(r.created_at)
                };
            });

            const date = DateTime.now().toFormat('yyyy-MM-dd');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=zimrate-export-${date}.json`);
            res.json(rows);
        } catch (err) {
            next(err);
        }
    }
}
