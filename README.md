# NorthPort

NorthPort is a deterministic pre-filing validation system for SEC Form N-PORT data. It ingests fund holdings data, checks it against the SEC Form N-PORT v1.13 XSD plus NorthPort internal data-quality rules, and returns a pass/fail validation verdict with errors and warnings for review. It does **not** file to EDGAR, it is **not** SEC-certified, and EDGAR XML serialization remains future work pending complete source data.

## Architecture

NorthPort has two validation tiers:

- **Tier 1: SEC schema validation.** The backend compiles the pinned SEC Form N-PORT v1.13 XSD bundle with local imports and network access disabled, then uses `lxml` schema validation for XML structure, field types, and cardinality.
- **Tier 2: Internal data-quality rules.** NorthPort runs explicit Python rules over the normalized filing and holdings model for identifiers, reference data, derivatives, and NAV reconciliation.

The pipeline is:

```text
ingestion -> Tier 1 XSD -> Tier 2 rules -> validation verdict
```

Ingestion accepts CSV, JSON, XML, and GCAP Stata `.dta` inputs where supported by the local backend. The validation philosophy is fail-closed: if required source fields are missing, redacted, or unusable, NorthPort records the derived value as unavailable and lets validation rules flag the gap. It does not fabricate source values to make a filing pass.

## Validated Metrics

Validated on a real GCAP 2025Q4 slice:

| Metric | Value |
| --- | ---: |
| Filings processed | 4,024 |
| Holdings scanned | 1,300,501 |
| Error-level findings | 11,632 |
| Warnings | 1,079 |
| Passed filings | 3,585 |
| Failed filings | 439 |
| Throughput | ~6.7K holdings/sec |
| Peak memory | ~668 MB/worker |

FX handling: non-USD valuations are computed as `currency_value / exchange_rate` and reconciled against ECB quarter-end reference rates for 31 Dec 2025: EUR ~0.851, GBP ~0.743, and JPY ~156.7 per USD. Missing, zero, or unusable rates fail closed rather than being substituted.

## Scope And Known Gaps

- `NP-LIQ-001` is cut because the verified GCAP slice has no liquidity-classification column. NorthPort does not substitute unrelated fields for SEC liquidity classification.
- EDGAR XML serialization is planned future work pending complete source data and full schema-backed element coverage.
- The Vercel deployment is a static frontend demo. Live validation, upload, row-level drilldown, and backend-backed reports run locally with FastAPI.

## Tech Stack

- Backend: Python, FastAPI, `lxml`, pydantic v2, pandas, pyreadstat, multiprocessing, SQLite.
- Frontend: React, TypeScript, Vite, Tailwind CSS.
- Built with AI-assisted development (Claude & Codex) as development tooling, not as runtime product technology.

## Screenshots

TODO after deploy:

- Dashboard: `docs/images/dashboard.png`
- Rules registry: `docs/images/rules.png`
- Batch monitor: `docs/images/batch.png`

Vercel demo link: TODO after deploy.

## Local Setup

Backend:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python3 -m northport.backend.runtime_check
uvicorn northport.backend.api.app:app --reload
```

The API defaults to `http://127.0.0.1:8000`.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE` if FastAPI is running somewhere other than `http://127.0.0.1:8000`.

## Static Demo Build

Vercel hosts the frontend only. Enable static demo mode so the production build renders audited GCAP reference metrics without calling FastAPI:

```bash
cd frontend
VITE_DEMO_MODE=true npm run build
```

In demo mode, metrics come from `frontend/src/lib/referenceRun.ts`. Controls that require the live backend show a static-demo message instead of raw fetch errors or empty failure states.
