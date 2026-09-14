import express from 'express';
import { RatesController } from '../controllers/RatesController.js';
import { AdminController } from '../controllers/AdminController.js';
import { AccountController } from '../controllers/AccountController.js';
import { ContactController } from '../controllers/ContactController.js';
import { BrandingController } from '../controllers/BrandingController.js';
import { EconomyController } from '../controllers/EconomyController.js';
import { WalletController } from '../controllers/WalletController.js';
import { handleGraphQLRequest } from '../graphql/server.js';
import { adminAuth, verifyIdToken } from '../middleware/auth.js';
import { verifyAppCheck, optionalAppCheck } from '../middleware/appCheck.js';

const router = express.Router();

// ── Public API endpoints ──────────────────────────────────────────────────────
router.all('/', RatesController.version0);
router.all('/v1', RatesController.version1);
// base is a path segment on v2: /api/v2/ZAR. The bare /v2 form is kept so it
// answers with a 400 explaining the shape rather than a bare "route not found".
router.all('/v2/:base', RatesController.version2);
router.all('/v2', RatesController.version2);

// Branding — public. The landing bundle is deliberately Firebase-free, so the
// public site reads the app name and asset URLs from here rather than Firestore.
router.get('/branding', BrandingController.publicGet);

// Contact form — public, but only accepts submissions when an admin has
// configured SMTP and enabled it.
router.get('/contact', ContactController.status);
router.post('/contact', ContactController.submit);

// Account deletion — the signed-in app or web user removing their own account.
// verifyIdToken without requireAdmin: these are ordinary users, and the uid the
// controller acts on comes from the token, so the route has no other target.
// Deliberately not left to the clients — the database rules forbid a client
// deleting its own wallet, and loosening them would drop the guard that stops
// an overdrawn grant being deleted.
router.delete('/account', verifyAppCheck, verifyIdToken, AccountController.deleteSelf);

// Coin purchases — the signed-in app user claiming coins they have paid Google for.
// Same middleware as account deletion and for the same reason: an ordinary user acting on their
// own uid, taken from the token. The grant is written with the Admin SDK so the database rules
// can forbid clients writing purchase rows at all, which is what stops coins being minted.
router.post('/wallet/purchase', verifyAppCheck, verifyIdToken, WalletController.creditPurchase);

// GraphQL endpoint — serverless approach.
// optionalAppCheck records whether the caller is a verified first-party client
// without shutting out the public Sandbox or third-party consumers.
router.post('/graphql', optionalAppCheck, handleGraphQLRequest);

// ── Admin endpoints (all require authenticated admin) ─────────────────────────
const adminRouter = express.Router();

// User management
adminRouter.get('/users', AdminController.listUsers);
adminRouter.post('/users', AdminController.createUser);
adminRouter.put('/users/:uid', AdminController.updateUser);
adminRouter.delete('/users/:uid', AdminController.deleteUser);
adminRouter.post('/users/:uid/claims', AdminController.setUserClaims);

// Coin economy — read-only. /users above is the console roster; app users are their own list
// because every install now creates an auth account, and the two have nothing to do with
// each other beyond sharing a user store.
adminRouter.get('/economy', EconomyController.overview);
adminRouter.get('/app-users', EconomyController.listAppUsers);
adminRouter.get('/app-users/:uid/wallet', EconomyController.userWallet);

// Source management
adminRouter.get('/sources', AdminController.listSources);
adminRouter.post('/sources', AdminController.createSource);
adminRouter.get('/sources/:id', AdminController.getSource);
adminRouter.put('/sources/:id', AdminController.updateSource);
adminRouter.delete('/sources/:id', AdminController.deleteSource);
adminRouter.post('/scrape', AdminController.triggerScrape);

// Rate management (admin view — all rates including disabled).
// No list endpoint: the admin SPA reads rates straight from Firestore, which
// gives it real cursor pagination and count aggregates that this API could not.
adminRouter.put('/rates/:id', AdminController.updateRate);
adminRouter.delete('/rates/:id', AdminController.deleteRate);

// Branding
adminRouter.get('/branding', BrandingController.get);
adminRouter.put('/branding', BrandingController.update);

// SMTP settings for the contact form
adminRouter.get('/smtp', ContactController.getSettings);
adminRouter.put('/smtp', ContactController.updateSettings);
adminRouter.post('/smtp/test', ContactController.testSettings);

// Import / Export
adminRouter.get('/export', AdminController.exportData);
adminRouter.post('/import', AdminController.importData);

// Mount admin router behind App Check + auth middleware.
// App Check first: cheapest rejection, and it is the anti-abuse layer.
router.use('/admin', verifyAppCheck, ...adminAuth, adminRouter);

export default router;
