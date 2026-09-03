# ZimRate

All Zimbabwean exchange rates from multiple sites in one RESTful / GraphQL API. No need to
scrounge the internet for the current day's rate.

Rates are scraped hourly from public sources, normalised, and served free with no API key and
no rate limits. All rates are quoted as **units of foreign currency per 1 USD**.

- Live site: <https://zimrate.tyganeutronics.com>
- Android app: [My Rate Calculator](https://play.google.com/store/apps/details?id=com.tyganeutronics.myratecalculator)
- WordPress plugin: <https://wordpress.org/plugins/zimrate>

---

## Architecture

| Piece | Stack | Location |
| --- | --- | --- |
| Public site + admin SPA | React 19, Vite 8, MUI 7, Apollo Client | `hosting/` |
| API + scheduled scraper | Node 22, Cloud Functions v2, Express, Apollo Server 4 | `functions/` |
| Page fetcher | Apify actor (Playwright / Cheerio) | `apify-actor/` |
| Rates, sources, options | Firestore | — |
| Cache + scrape lock | Realtime Database | — |
| Previous Angular UI | Angular 16 (retired, kept for reference) | `hosting-legacy/` |

Two Cloud Functions are deployed, both in `us-central1`:

- `zimrate_app` — the whole Express app, reached via the hosting rewrite `/api/**`
- `zimrate_scrape` — Cloud Scheduler tick (see [Scraping](#scraping))

The browser only ever talks to `/api/**` on the same origin; Firebase Hosting rewrites that to
`zimrate_app`.

---

## API

No authentication. `/api`, `/api/v1` and `/api/v2` support JSONP via `?callback=` and accept
both GET and form-encoded POST.

| Endpoint | Purpose |
| --- | --- |
| `ALL /api` | v0, legacy shape |
| `ALL /api/v1` | main endpoint — `search`, `name`, `currency`, `date`, `prefer`, `extra`, `info` |
| `ALL /api/v2` | cross rates — requires `base` |
| `POST /api/graphql` | GraphQL, introspection on — `search`, `currency`, `date`, `base`, `prefer` |
| `GET/POST /api/contact` | contact form (see [Contact form](#contact-form)) |
| `/api/admin/**` | admin only — Firebase ID token + `admin` claim + App Check |

`prefer` accepts `min`, `max`, `mean`, `median`, `mode`, `random`.

```bash
curl -X POST https://zimrate.tyganeutronics.com/api/v1 -d 'prefer=mean'
```

`base` picks the currency rates are quoted against, using the same cross-rate maths in both
places: required as a path segment on v2, optional on GraphQL. Omit it on GraphQL and rates
come back per 1 USD as before. It accepts `USD` or any currency the API currently serves, and
the base currency is left out of its own results.

```bash
curl -X POST https://zimrate.tyganeutronics.com/api/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ rate(base: ZAR, prefer: MEAN) { currency rate } }"}'
```

The OpenAPI spec is at `hosting/public/docs/documentation.yaml` and is rendered on `/developers`.

---

## Setup

### Prerequisites

- Node 22 (matches the Cloud Functions runtime)
- `npm i -g firebase-tools`, then `firebase login`
- A Firebase project on the Blaze plan (Cloud Functions require it)

### Install

```bash
git clone https://github.com/richard-muvirimi/zimrate-server.git
cd zimrate
npm --prefix functions install
npm --prefix hosting install
```

Point at your own Firebase project:

```bash
firebase use --add          # writes .firebaserc
```

### Configure

**`functions/.env`** — server-side secrets. Copy from `functions/.env.example`. Never commit
this file; it is gitignored.

| Variable | Purpose |
| --- | --- |
| `APIFY_TOKEN` | Apify API token for the page fetcher |
| `APIFY_ACTOR_ID` | actor id, e.g. `tyganeutronics~zimrate-page-fetcher` |
| `DEEPSEEK_API_KEY` | API key for the extraction model |
| `DEEPSEEK_API_URL` | chat-completions endpoint; defaults to DeepSeek |
| `DEEPSEEK_MODEL` | model name; defaults to `deepseek-chat` |
| `APPCHECK_ENFORCE` | `true` to enforce App Check on `/api/admin/**`. Leave unset while rolling out |

### Swapping the LLM provider

Rate extraction uses the official `openai` SDK against an OpenAI-format endpoint, so switching
provider is only those three variables. `DEEPSEEK_API_URL` accepts either the base URL or the
full chat-completions path. Gemini exposes an OpenAI-compatible
endpoint, so it drops straight in:

```bash
DEEPSEEK_API_KEY=<google-ai-studio-key>
DEEPSEEK_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
DEEPSEEK_MODEL=gemini-2.0-flash
```

The replacement must support **tool calling** (`tools` + `tool_choice`) and
**`response_format: { type: 'json_object' }`** — the extractor runs an agentic loop that calls
`convert_cross_rate_to_usd` for cross-rate pages, then asks for strict JSON. Providers that only
implement basic completions will not work. Verify with a manual scrape after switching.

**`hosting/.env.production`** — client config. Everything here ships in the browser bundle, so
it must contain **no secrets**. The Firebase web config and reCAPTCHA site key are public by
design.

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_*` | web config; falls back to the literals in `hosting/src/config.ts` |
| `VITE_PUBLIC_API_ORIGIN` | origin shown in copyable API examples |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key; empty disables App Check |
| `VITE_API_BASE_URL` | prefix for API calls; empty means same origin |

### Run locally

```bash
npm --prefix hosting run dev
```

The dev server proxies `/api` to the deployed API, so you develop against real data. Override
with `VITE_DEV_API_TARGET` if you want to point somewhere else — for example a local functions
emulator (`firebase emulators:start --only functions`, then set it to
`http://localhost:5001/<project-id>/us-central1/zimrate_app`).

### Deploy

```bash
firebase deploy
```

Predeploy hooks run automatically and will abort the deploy on failure:

- functions: `npm run lint` then `npm test`
- hosting: `npm run lint` then `npm run build`

---

## First admin

Admin access is Firebase Auth plus an `admin` custom claim. `POST /api/admin/users/:uid/claims`
grants it, but that endpoint itself requires an admin — so the **first** admin must be granted
out of band with the Admin SDK:

```js
// bootstrap-admin.js — run once with GOOGLE_APPLICATION_CREDENTIALS set
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp();
const user = await getAuth().getUserByEmail('you@example.com');
await getAuth().setCustomUserClaims(user.uid, { admin: true });
console.log('granted admin to', user.uid);
```

Sign out and back in afterwards so the new claim lands in a fresh ID token.

Accounts must also have a **verified email** — the admin UI redirects unverified users to the
verification screen and blocks access until they confirm.

---

## Contact form

Disabled until SMTP is configured. In the admin dashboard go to **Email / SMTP** and set host,
port, TLS mode, username, password, from name/address and the delivery recipient, then use
**Test connection** to verify before enabling.

Credentials are stored at `settings/smtp` in Firestore, which `firestore.rules` denies to every
client including admins. They are readable only by the Admin SDK behind `/api/admin/smtp`, and
the API never returns the password — only whether one is set.

---

## Scraping

`zimrate_scrape` is scheduled `* * * * *`, but the work is throttled by a `scrape_lock` key in
the Realtime Database that is held until the top of the next hour. So scraping runs **hourly**;
the minute tick exists so the admin "trigger scrape" action takes effect within a minute rather
than waiting up to an hour.

Set the `scraping_enabled` option to `false` to pause scraping without redeploying.

### Adding a source

Add a document to the `sources` collection, or use **Sources** in the admin dashboard.

| Field | Meaning |
| --- | --- |
| `name` | display name |
| `url` | page to scrape |
| `enabled` | include in scheduled runs |
| `javascript` | render with a real browser before extracting |

The scraper fetches the page through Apify, strips chrome, and asks DeepSeek to extract the
rates, so no CSS selectors are needed — unlike the older selector-based setup.

---

## Tests and linting

```bash
npm --prefix functions test     # vitest, API contract tests
npm --prefix functions run lint
npm --prefix hosting run lint
npm --prefix hosting run build  # tsc -b && vite build
```

---

## Contributing

Contributions and issue reports are welcome:
<https://github.com/richard-muvirimi/zimrate-server/issues>

Forking is fine. Note that a fork is only useful with your own Firebase project, Apify token and
DeepSeek key — none of which are in this repository.
