import express from 'express';
import 'dotenv/config';
import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import apiRoutes from './routes/api.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { logAnalytics } from './middleware/analytics.js';
import cors from 'cors';
import { runScrape } from './jobs/scrape.js';
import { runPurge } from './jobs/purge.js';
import { runSourceTest } from './jobs/testSource.js';
import { runSourceScrape } from './jobs/scrapeSource.js';
import { runSourceRatesDelete } from './jobs/deleteSourceRates.js';
import { runScheduledDiscovery, runDiscoveryRequest, runCandidateTest, runCandidateRetest } from './jobs/discover.js';

const app = express();

setGlobalOptions({ maxInstances: 5, memory: '256MiB' });

initializeApp();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // increased for import payloads
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', logAnalytics, apiRoutes);

// Error handling middleware
app.use(errorHandler);
app.use(notFoundHandler);

// ── Main HTTP function ────────────────────────────────────────────────────────
// timeoutSeconds 300: scrape endpoint calls Apify (~60s) + LLM (~15s) + Firestore
export const zimrate_app = onRequest({ timeoutSeconds: 300, memory: '512MiB', region: 'us-central1' }, app);

// ── Scheduled scraping function ───────────────────────────────────────────────
export const zimrate_scrape = onSchedule({
    schedule: '* * * * *',
    region: 'us-central1', // Cloud Scheduler is not available in africa-south1
    memory: '512MiB',
    timeoutSeconds: 540,
}, runScrape);

// ── Wallet retention and economy snapshot ─────────────────────────────────────
export const zimrate_purge = onSchedule({
    schedule: '17 3 * * *',
    timeZone: 'Africa/Harare',
    region: 'us-central1', // Cloud Scheduler is not available in africa-south1
    memory: '512MiB',
    timeoutSeconds: 540,
}, runPurge);

// ── Source test (dry-run scrape requested by the admin source form) ───────────
// timeoutSeconds 300: up to two Apify fetches (static, then browser) + LLM
export const zimrate_source_test = onDocumentCreated({
    document: 'source_tests/{testId}',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
}, runSourceTest);

// ── Source scrape (one source on demand, from the admin Sources page) ─────────
// timeoutSeconds 300: one Apify fetch + LLM (with its backup) + Firestore
export const zimrate_source_scrape = onDocumentCreated({
    document: 'source_scrapes/{scrapeId}',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
}, runSourceScrape);

// ── Source deletion takes its rates with it ───────────────────────────────────
export const zimrate_source_deleted = onDocumentDeleted({
    document: 'sources/{sourceId}',
    region: 'us-central1',
}, runSourceRatesDelete);

// ── Source discovery ──────────────────────────────────────────────────────────
// Weekly, and only when discovery_enabled is on; see jobs/discover.js.
export const zimrate_discover = onSchedule({
    schedule: '0 5 * * 1',
    timeZone: 'Africa/Harare',
    region: 'us-central1', // Cloud Scheduler is not available in africa-south1
    memory: '512MiB',
    timeoutSeconds: 300,
}, runScheduledDiscovery);

// timeoutSeconds 300: one Apify search run (allowed 240s) + Firestore
export const zimrate_discover_request = onDocumentCreated({
    document: 'discovery_runs/{runId}',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
}, runDiscoveryRequest);

// timeoutSeconds 540: the same two-fetch dry run as zimrate_source_test, but a
// run's candidates all start together and queue for Apify's five run slots
// (see utils/apify.js), so each fetch may first wait up to two minutes.
export const zimrate_candidate_test = onDocumentCreated({
    document: 'source_candidates/{candidateId}',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
}, runCandidateTest);

// timeoutSeconds 540: the same vetting as zimrate_candidate_test
export const zimrate_candidate_retest = onDocumentCreated({
    document: 'candidate_retests/{retestId}',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
}, runCandidateRetest);
