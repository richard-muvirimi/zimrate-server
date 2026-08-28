import express from 'express';
import { RatesController } from '../controllers/RatesController.js';
import { AdminController } from '../controllers/AdminController.js';
import { ContactController } from '../controllers/ContactController.js';
import { BrandingController } from '../controllers/BrandingController.js';
import { handleGraphQLRequest } from '../graphql/server.js';
import { adminAuth } from '../middleware/auth.js';
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
