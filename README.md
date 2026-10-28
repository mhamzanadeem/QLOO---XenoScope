# XenoScope

**See Beyond the Surface.** A decision-first workspace for exploring cultural signals across markets, venues, and business concepts. Built with React, Vite, Recharts, Lucide, Zod, and server-side JavaScript, prepared for a single Vercel deployment.

## What works

- Landing page with original local SVG identity and city-scanning artwork.
- Market, venue, and concept exploration modes and guided comparison builders.
- Live Qloo comparisons with verified tags, selected venues, and user-entered locations.
- Side-by-side results, tag-count charts and accessible tables, category/search filters, sorting, and differences-only controls.
- Finding pages with source IDs, underlying entity evidence, query metadata, and caveats.
- Save, reopen, and delete explorations in this browser (up to 30; no account or cross-device sync).
- Validated JSON/CSV downloads and print-friendly HTML reports for browser PDF printing.
- Visible Qloo provenance, useful validation, request errors, empty states, and reduced-motion behavior.

Cultural affinity does **not** predict revenue, profitability, demand, foot traffic, or business success.

## Local setup

Node.js 22.12+ (verified here with Node 24.18) and npm are required. Python is not required.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The Vite development plugin serves the same API router used by Vercel. Qloo credentials are required. Choose **Start exploring**, select a mode, resolve tags or venues, and run a comparison. There is no demo switch or fallback. An accessible modal appears if Qloo is not configured, rejects access, rate limits requests, times out, or cannot be reached.

Required server configuration:

```sh
cp .env.example .env.local
```

On PowerShell use `Copy-Item .env.example .env.local`. Set `QLOO_API_KEY` in `.env.local`, then restart the development server. `QLOO_BASE_URL` defaults to `https://api.qloo.com`; only Qloo's production, staging, and hackathon API origins are accepted. Keys are never sent to the frontend. Do not use a `VITE_` prefix for secrets.

## Architecture and files

```text
api/index.js              Single Vercel Node function
server/router.js          Shared HTTP router, validation, size and rate limits
server/qloo.js            Qloo authentication, timeouts, normalization, live comparison
shared/schema.js          Request and report schemas
shared/compare.js         Deterministic matching, coverage, filtering, exports
src/App.jsx               Seven main product views plus methodology
src/SignalChart.jsx       Lazy-loaded Recharts visualization
src/store.js              Browser-local saves and API/download helpers
src/styles.css            Design tokens, responsive layout, focus and print styles
public/brand/             Logo, icon, mark, and original city SVG artwork
tests/                    Comparison, API, and React workflow tests
e2e/                      Desktop and mobile browser workflows
vercel.json               API and SPA routing, basic response headers
```

There is no production filesystem persistence, separate backend service, paid LLM, required paid map service, or database. Browser saves are local convenience storage and can be cleared by the browser. Export important work.

## Live Qloo integration

Implemented against the [official API overview](https://github.com/qloo/docs-public/blob/main/reference/api-overview.md), [Insights reference](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md), [location guide](https://github.com/qloo/docs-public/blob/main/reference/insights-with-location-use-case.md), and [hackathon kit](https://github.com/qloo/qloo-hackathon-kit). Authentication uses the documented `X-Api-Key` header. All upstream calls originate on the server, with a 12-second timeout and no automatic retry amplification.

| App route | Upstream route | Behavior |
| --- | --- | --- |
| `GET /api/health` | None | Minimal health response |
| `GET /api/config` | None | Safe configured/capability flags |
| `GET /api/qloo/status` | `/search` | Minimal authenticated accessibility probe |
| `GET /api/entities/search?q=` | `/search` | Place search using `query`, `types`, bounded `take` |
| `GET /api/tags/search?q=` | `/v2/tags` | Tag lookup using `filter.query` |
| `GET /api/insights?entityId=&tagId=&location=` | `/v2/insights` | Allowlisted place recommendations |
| `POST /api/compare` | `/v2/insights` | Two bounded result sets, then deterministic comparison |
| `GET /api/trends?entityId=&start=&end=` | `/trends/entity` | Validated UUID and date range, source-labeled raw response |
| `POST /api/report` | None | Validate result and recompute JSON/CSV report |

Live **market** mode requires selecting a verified tag; it applies the same tag and `filter.type=urn:entity:place` to both exact `filter.geocode.name` city filters. The free-text business concept is a research label; the selected tag is the actual API anchor. Qloo can reject unsupported tag/place combinations or return no results for a city. Live **concept** mode uses a separately selected verified tag for each concept and one shared exact city filter. Live **venue** mode requires selecting each venue from search and uses its ID as `signal.interests.entities` for place recommendations; these are surrounding recommendations, not the source venue's profile.

The configured hackathon host was checked successfully with real entity-search and tag-search requests. A Lahore/Islamabad insights comparison timed out within the request window; its error remains visible rather than producing substitute data. Response shape and error behavior are also covered with mocked upstream responses. Geographic coverage and tag compatibility can still vary.

### Explicit capability limits

- Live concept labels are explicitly anchored to selected Qloo tags. A label alone is never treated as a verified signal. Tag/place compatibility and account coverage may limit any mode.
- Native `/v2/analysis/compare` was reviewed, but its undocumented response shape in the linked public reference is not interpreted. Our comparison is local set alignment, not a claim of native Qloo comparison output.
- Demographic, heatmap, and financial fields are unavailable in the comparison; no synthetic replacement is displayed.
- The trend API route preserves raw upstream data with provenance; no time-series chart is shown until a supported response model is verified.
- Missing metrics remain `null`. Tag counts measure returned entity metadata, not citywide interest or prevalence. No cross-query affinity ranking or success score is computed.
- Application comparisons reject demo requests. Older demo saves are excluded from the saved list; their stored data is not deleted. Connection failures show a modal with retry and close controls, preserving current inputs.

## Checks

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm audit
```

Unit and React tests cover normalization, deduplication, shared/differing tags, missing and incompatible measures, sorting/filtering, synthetic test responses, validation, missing key, upstream errors, exports, and the main page flow. Browser tests cover live-only comparisons, evidence, local persistence, exports, mobile connection dialogs, retry recovery, and upstream errors without fallback. Browser installation is only needed for browser QA. `npm run preview` previews static production assets only; use `npm run dev` or `vercel dev` for an API-enabled local app.

## Deploy to Vercel

1. Push this repository to your Git provider and import it in Vercel.
2. Use the Vite preset, Node.js 22+ runtime, install command `npm ci`, build command `npm run build`, and output `dist`.
3. Set `QLOO_API_KEY` in Vercel environment variables for live mode. Without a key, the app shows the Qloo availability modal. The optional base URL is documented in `.env.example`.
4. Deploy. `api/index.js` serves all `/api/*` routes through the rewrite's `route` query value; the SPA fallback preserves deep links. No always-running server is needed.
5. Verify `/api/health`, `/api/config`, `/build/market`, and the Qloo availability modal. With credentials, verify tag search, venue search, and all three live comparison modes. A rejected live query must show an error rather than a demo success.

No deployment has been performed by this build. Vercel routing is prepared but needs verification in the deployed environment.

## Security and operating notes

Inputs and client-supplied report structures are validated; request bodies are capped at 150 KB. Upstream hosts and parameters are allowlisted. React renders text safely, CSV cells are quoted and guarded against formula injection, and exported filenames are fixed. Public config exposes only flags. Errors omit upstream bodies, credentials, and stack traces. Calls have bounded timeouts and no retries. Security headers are configured in `vercel.json`.

The per-instance rate limit (90 requests/minute, bounded map) is best-effort, not durable or globally enforced. Configure Vercel WAF/rate limiting and usage controls for public production traffic. No CORS grant is needed because the frontend and API are same-origin. Reports validate structure but cannot cryptographically authenticate client-provided evidence; locally saved/exported results are research artifacts, not signed source certificates. No personal information is collected. External font loading has system fallbacks.

## Research workflow

Select **Investigate coverage and suggest a next step** in any comparison form.
`POST /api/research` accepts the same request as `/api/compare`. It retrieves two
result sets, checks metadata coverage, and searches for up to five alternative
tags when either sample has fewer than three tagged places (non-venue modes).
The workflow makes at most three upstream calls, does not silently replace the
selected anchors, and presents its activity and evidence in a research brief.
It is a deterministic, bounded workflow, not an LLM planner or a cross-domain
recommendation engine. The coverage threshold is not a statistical confidence
measure. Research briefs are preserved in saved results and JSON exports.

## License

Application source is MIT licensed; see LICENSE. Third-party dependencies and
Qloo data remain subject to their respective licenses and API terms.

## Repository scope

Runtime source, brand assets, build/deploy configuration, the license, and automated
tests belong in Git. Synthetic responses live only in `tests/fixtures`; no live API
key is required for unit tests. Application schemas accept live results only.
Retired demo datasets, their generator, one-time asset generation, old build prompts,
local verification history, and commit helper scripts are ignored local archives.
`test-results`, dependencies, generated builds, and secrets are also ignored.
