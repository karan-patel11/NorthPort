# NorthPort

NorthPort is a pre-filing validation system for SEC Form N-PORT data. It ingests
CSV, JSON, or raw XML sources, validates them in two tiers, generates XML, and
produces an audit trail that ties each failure back to a rule and source row.

## What is built

- Pydantic v2 filing, header, holding, identifier, derivative, and provenance models
- Fail-closed CSV/JSON ingestion with source-row provenance
- Streaming GCAP `.dta` ingestion via `pyreadstat.read_dta(row_limit, row_offset)`
- Tier-2 business-rule registry with identifier, currency, fair-value, liquidity,
  derivative, and NAV reconciliation rules
- Tier-1 XSD validation wrapper using `lxml.etree.XMLSchema` over the pinned
  SEC schema bundle
- XML generation and round-trip hooks that refuse to run until the real
  schema-backed element mapping is implemented
- Process-pool batch harness with SQLite content-hash cache
- FastAPI endpoints for filings, holdings, audit reports, XML download, and batches
- React + TypeScript + Vite frontend with TanStack Query/Table/Virtual and Recharts

## Correctness gate

The production SEC XSD is intentionally not replaced by a permissive local schema.
Pin the official schema bundle and point NorthPort at the bundle entrypoint:

```text
NORTHPORT_XSD_DIR=/path/to/sec/xsd/bundle
NORTHPORT_XSD_ENTRYPOINT=sec_nport.xsd
```

`NORTHPORT_XSD_PATH=/path/to/sec_nport.xsd` can be used instead when the
entrypoint file is known directly. Until the bundle compiles, Tier-1 raises
`SchemaUnavailableError`, API startup fails, and XML intake fails closed. See
[SCHEMA_SOURCE.md](/Users/karanpatel/Documents/NorthPort/northport/backend/schemas/SCHEMA_SOURCE.md)
for the pinning record to complete during Milestone 1.

## Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python3 -m northport.backend.runtime_check
python3 -m pytest
uvicorn northport.backend.api.app:app --reload
```

The same setup is available as:

```bash
make setup
make check-runtime
```

The API defaults to `http://127.0.0.1:8000`.

Inspect the real GCAP mapping without loading the whole slice:

```bash
python3 -m northport.backend.ingest.inspect_dta /Users/karanpatel/Downloads/gcap_slice/2025q4.dta --limit 10
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE` if the API is not running on `http://127.0.0.1:8000`.

## Milestone Metrics

NorthPort shows measured values only. Where no real run exists, the API and UI
return/show `no data`.

Record these after the SEC XSD and EDGAR fixtures are pinned:

| Metric | Current value | Target evidence |
| --- | ---: | --- |
| Tier-2 discrepancy rate | Real GCAP run required | per-rule flag rate against streamed GCAP rows |
| Tier-1 schema pass/fail | Pending XSD/EDGAR dirs | real EDGAR XML validation |
| Throughput | Pending benchmark | measured filings/sec and holdings/sec |
| Memory | Pending benchmark | peak resident MB per worker |
| Cache hit rate | Covered by unit test | rerun hit percentage |

Headline format:

```text
Streaming N-PORT validation pipeline: X% schema conformance across N SEC filings,
processing Y filings/sec at constant Z MB/worker across M cores.
```

## Repo Layout

```text
northport/backend/
  api/           FastAPI app
  generate/      XML builder and round-trip checks
  harness/       dispatcher, worker, SQLite cache
  ingest/        CSV/JSON/XML intake
  models/        Pydantic internal model
  schemas/       pinned SEC schema location
  tests/         fixtures and unit tests
  validate/      Tier-1 XSD and Tier-2 rule registry
frontend/
  src/components dense fintech UI primitives
  src/screens    dashboard, upload, filing detail, report, batch, rules
docs/
  field_mapping.md
```
