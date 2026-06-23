NorthPort

<p align="center">
  <strong>Deterministic SEC N-PORT Pre-Filing Validation</strong>
</p>
<p align="center">
  Validate fund holdings data against SEC Form N-PORT schema requirements and internal data-quality controls before filing (Not SEC certified).
</p>
<p align="center">
  <a href="https://north-port.vercel.app"><strong>Live Demo</strong></a>
  ·
  <a href="#architecture">Architecture</a>
  ·
  <a href="#validated-metrics">Validated Metrics</a>
  ·
  <a href="#local-setup">Local Setup</a>
</p>
<p align="center">
  <img alt="Frontend" src="https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript%20%7C%20Vite-blue">
  <img alt="Backend" src="https://img.shields.io/badge/Backend-Python%20%7C%20FastAPI%20%7C%20lxml-green">
  <img alt="Validation" src="https://img.shields.io/badge/Validation-Fail--Closed-orange">
  <img alt="Demo" src="https://img.shields.io/badge/Demo-Live%20on%20Vercel-black">
</p>

⸻

Overview

NorthPort is a deterministic pre-filing validation system for SEC Form N-PORT data. It ingests fund holdings data, checks it against the SEC Form N-PORT v1.13 XSD plus NorthPort internal data-quality rules, and returns a pass/fail validation verdict with errors and warnings for review.

NorthPort does not file to EDGAR, it is not SEC-certified, and EDGAR XML serialization remains future work pending complete source data.

Live demo: https://north-port.vercel.app

⸻

Executive Snapshot

Area	Detail
Product type	SEC Form N-PORT pre-filing validation system
Core behavior	Deterministic validation, fail-closed data handling, rule-based error reporting
Frontend demo	Static Vercel deployment with audited reference metrics
Backend mode	Local FastAPI service for ingestion, validation, and report workflows
Validation tiers	SEC XSD schema validation + internal data-quality rules
Supported inputs	CSV, JSON, XML, and GCAP Stata .dta where supported locally
Current limitation	No EDGAR submission or production SEC filing workflow

⸻

Validation Flow

                         ┌─────────────────────────────┐
                         │      Source Holdings Data     │
                         │ CSV · JSON · XML · GCAP DTA   │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                  ╔════════════════════════════════════════════╗
                  ║              NORTHPORT CORE                ║
                  ║                                            ║
                  ║   ┌────────────────────────────────────┐   ║
                  ║   │  01. Normalize filing + holdings   │   ║
                  ║   └────────────────┬───────────────────┘   ║
                  ║                    │                       ║
                  ║                    ▼                       ║
                  ║   ┌────────────────────────────────────┐   ║
                  ║   │  02. Tier 1 SEC XSD validation     │   ║
                  ║   │      Form N-PORT v1.13             │   ║
                  ║   └────────────────┬───────────────────┘   ║
                  ║                    │                       ║
                  ║                    ▼                       ║
                  ║   ┌────────────────────────────────────┐   ║
                  ║   │  03. Tier 2 internal DQ rules      │   ║
                  ║   │      identifiers · NAV · FX · refs │   ║
                  ║   └────────────────┬───────────────────┘   ║
                  ║                    │                       ║
                  ║                    ▼                       ║
                  ║   ┌────────────────────────────────────┐   ║
                  ║   │  04. Pass/fail verdict + findings  │   ║
                  ║   └────────────────────────────────────┘   ║
                  ╚════════════════════════════════════════════╝
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │ Reviewable Validation Report │
                         │ Errors · Warnings · Metrics  │
                         └─────────────────────────────┘

NorthPort follows a fail-closed validation philosophy: if required source fields are missing, redacted, zeroed, or unusable, NorthPort records the derived value as unavailable and lets validation rules flag the gap. It does not fabricate source values to make a filing pass.

⸻

Architecture

NorthPort has two validation tiers.

Tier 1: SEC Schema Validation

The backend compiles the pinned SEC Form N-PORT v1.13 XSD bundle with local imports and network access disabled. It then uses lxml schema validation for XML structure, field types, and cardinality.

Tier 2: Internal Data-Quality Rules

NorthPort runs explicit Python validation rules over the normalized filing and holdings model. These rules cover identifiers, reference data, derivatives, NAV reconciliation, numeric consistency, and cross-field integrity checks.

The pipeline is:

ingestion -> Tier 1 XSD -> Tier 2 rules -> validation verdict

⸻

Validated Metrics

Validated on a real GCAP 2025Q4 slice:

Metric	Value
Filings processed	4,024
Holdings scanned	1,300,501
Error-level findings	11,632
Warnings	1,079
Passed filings	3,585
Failed filings	439
Throughput	~6.7K holdings/sec
Peak memory	~668 MB/worker

FX handling: non-USD valuations are computed as currency_value / exchange_rate and reconciled against ECB quarter-end reference rates for 31 Dec 2025: EUR ~0.851, GBP ~0.743, and JPY ~156.7 per USD. Missing, zero, or unusable rates fail closed rather than being substituted.

⸻

Product Surface

The frontend demo presents the validation workflow as an operator-facing dashboard:

* Dashboard: high-level filing, holdings, pass/fail, and finding metrics.
* Filing detail: filing-level validation status and finding breakdown.
* Rules registry: internal rule coverage and rule metadata.
* Batch monitor: batch validation summary and processing state.
* Audit report: review-oriented validation output.
* Upload flow: static demo message on Vercel; local backend handles live ingestion.

The Vercel deployment is intentionally a static frontend demo. Live validation, upload, row-level drilldown, and backend-backed reports run locally with FastAPI.

⸻

Scope And Known Gaps

* NP-LIQ-001 is cut because the verified GCAP slice has no liquidity-classification column. NorthPort does not substitute unrelated fields for SEC liquidity classification.
* EDGAR XML serialization is planned future work pending complete source data and full schema-backed element coverage.
* The Vercel deployment is a static frontend demo. Live validation, upload, row-level drilldown, and backend-backed reports run locally with FastAPI.
* NorthPort is not SEC-certified and does not submit filings to EDGAR.

⸻

Tech Stack

Layer	Technologies
Backend	Python, FastAPI, lxml, pydantic v2, pandas, pyreadstat, multiprocessing, SQLite
Frontend	React, TypeScript, Vite, Tailwind CSS
Validation	SEC Form N-PORT v1.13 XSD, local schema compilation, internal Python rules
Deployment	Vercel static frontend demo
Development tooling	Claude and Codex used as AI-assisted development tools, not runtime product technology

⸻

Screenshots

The repository includes screenshot slots under docs/images/.

View	Path
Dashboard	docs/images/dashboard.png
Rules registry	docs/images/rules.png
Batch monitor	docs/images/batch.png

Live demo: https://north-port.vercel.app

⸻

Local Setup

Backend

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python3 -m northport.backend.runtime_check
uvicorn northport.backend.api.app:app --reload

The API defaults to:

http://127.0.0.1:8000

Frontend

cd frontend
npm install
npm run dev

Set VITE_API_BASE if FastAPI is running somewhere other than:

http://127.0.0.1:8000

⸻

Static Demo Build

Vercel hosts the frontend only. Enable static demo mode so the production build renders audited GCAP reference metrics without calling FastAPI:

cd frontend
VITE_DEMO_MODE=true npm run build

In demo mode, metrics come from:

frontend/src/lib/referenceRun.ts

Controls that require the live backend show a static-demo message instead of raw fetch errors or empty failure states.

⸻

Vercel Deployment

Current live deployment:

https://north-port.vercel.app

Recommended Vercel settings:

Root Directory: ./
Build Command: cd frontend && VITE_DEMO_MODE=true npm run build
Output Directory: frontend/dist
Install Command: cd frontend && npm ci
Environment Variable: VITE_DEMO_MODE=true

The VITE_DEMO_MODE=true environment variable is required for the hosted demo to render reference metrics without a live backend.

⸻

Repository Notes

NorthPort is designed as a validation and review system, not an SEC submission platform. The core engineering goal is to make pre-filing quality checks explicit, reproducible, and auditable before downstream filing workflows.

The project prioritizes:

* deterministic computation over probabilistic inference,
* schema-backed validation over informal checks,
* fail-closed handling over silent substitution,
* reviewable errors and warnings over black-box verdicts.
