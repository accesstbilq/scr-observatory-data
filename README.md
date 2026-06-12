# Supply Chain Observatory Collector

Node.js script that aggregates supply chain industry data from six free public APIs and writes a single `observatory.json` file for public hosting (e.g. Webflow fetch, GitHub Pages raw URL).

## Requirements

- Node.js 18+ (uses built-in `fetch`)

## Setup

```bash
cd collector
```

Optional environment variables (see `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENALEX_MAILTO` | _(none)_ | Email for OpenAlex polite pool |
| `SEC_EDGAR_USER_AGENT_EMAIL` | `contact@supplychainresearch.com` | Contact in SEC User-Agent header |

## Run

```bash
npm run collect
```

This writes `observatory.json` to the project root with:

- `labor_market` — BLS employment, wages, openings, quits
- `economic_indices` — FRED freight, inventory, production, prices
- `research_trends` — OpenAlex publication counts by topic + top institutions
- `corporate_filings` — SEC EDGAR keyword filing counts by year
- `trade_flows` — UN Comtrade US import values for automation machinery
- `logistics_performance` — World Bank LPI scores by country

If a source fails, that section is written as an empty object and a warning is logged; other sources still complete.

## Rate limits

| Source | Limit / notes |
|--------|----------------|
| **BLS** | v1: 25 requests/day (no key). This script uses 5 calls per run. |
| **FRED** | Public CSV endpoint; no key. Be reasonable with frequency (daily cron is fine). |
| **OpenAlex** | ~10 req/sec. This script makes 6 calls per run. Use `OPENALEX_MAILTO` for polite pool. |
| **SEC EDGAR** | Max ~10 req/sec; requires descriptive `User-Agent`. Script uses 150ms delay between calls (18 total). |
| **UN Comtrade** | Public preview API; 8 calls per run. Annual data may lag. |
| **World Bank** | Open API; 5 calls per run. LPI is updated biennially. |

## Scheduling

A GitHub Actions workflow at `.github/workflows/collect.yml` runs daily, executes `npm run collect`, and commits the updated `observatory.json` back to the repo.

For a VPS cron job:

```cron
0 6 * * * cd /path/to/collector && npm run collect
```

## Output schema

Top-level keys: `generated_at`, `sources`, `labor_market`, `economic_indices`, `research_trends`, `corporate_filings`, `trade_flows`, `logistics_performance`.
