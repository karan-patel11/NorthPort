from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from northport.backend.generate import assert_round_trip_stable
from northport.backend.generate.xml_builder import SecXmlGenerationUnavailable
from northport.backend.harness import run_batch
from northport.backend.ingest import ParseError, load_filing
from northport.backend.models import Filing
from northport.backend.validate import validate_filing
from northport.backend.validate.registry import RULES
from northport.backend.validate.tier1_xsd import assert_schema_ready


@asynccontextmanager
async def lifespan(app: FastAPI):
    del app
    assert_schema_ready()
    yield


app = FastAPI(title="NorthPort API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_jobs: dict[str, dict] = {}


class BatchRequest(BaseModel):
    paths: list[str]
    workers: int | None = None
    cache_path: str | None = ".cache/northport.sqlite"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.head("/health")
def health_head() -> Response:
    return Response(status_code=200)


@app.get("/dashboard")
def get_dashboard() -> dict:
    filing_jobs = [
        (job_id, job)
        for job_id, job in _jobs.items()
        if job.get("summary") is not None and job.get("filing") is not None
    ]
    batch_jobs = [job for job in _jobs.values() if job.get("batch") is not None]

    total_filings = len(filing_jobs)
    passed_filings = sum(1 for _, job in filing_jobs if job["summary"].passed)
    failed_filings = total_filings - passed_filings
    total_holdings = sum(job["summary"].total_holdings for _, job in filing_jobs)
    errors = sum(job["summary"].errors for _, job in filing_jobs)
    warnings = sum(job["summary"].warnings for _, job in filing_jobs)

    latest_batch = batch_jobs[-1]["batch"] if batch_jobs else None
    if latest_batch is not None:
        total_filings += latest_batch.total_filings
        passed_filings += latest_batch.passed_filings
        failed_filings += latest_batch.failed_filings
        total_holdings += latest_batch.total_holdings
        errors += sum(result.get("errors", 0) for result in latest_batch.results)
        warnings += sum(result.get("warnings", 0) for result in latest_batch.results)

    has_data = total_filings > 0
    rule_flag_rates = _dashboard_rule_flag_rates(filing_jobs, latest_batch, total_filings, total_holdings)
    tier2_denominator = sum(
        item["denominator"] or 0 for item in rule_flag_rates if item["status"] == "live"
    )
    tier2_flags = sum(item["flagged"] for item in rule_flag_rates if item["status"] == "live")
    recent = []
    for job_id, job in filing_jobs[-10:]:
        filing = job["filing"]
        summary = job["summary"]
        recent.append(
            {
                "id": job_id,
                "fund": _fund_label(filing),
                "period": filing.header.report_period_end.isoformat(),
                "holdings": summary.total_holdings,
                "errors": summary.errors,
                "warnings": summary.warnings,
                "conformance_percent": 100.0 if summary.passed else 0.0,
                "status": "pass" if summary.passed else "fail",
            }
        )

    return {
        "has_data": has_data,
        "total_filings": total_filings,
        "passed_filings": passed_filings,
        "failed_filings": failed_filings,
        "total_holdings": total_holdings,
        "open_errors": errors,
        "warnings": warnings,
        "conformance_percent": (passed_filings / total_filings * 100) if has_data else None,
        "tier2_discrepancy_rate": (tier2_flags / tier2_denominator) if tier2_denominator else None,
        "rule_flag_rates": rule_flag_rates,
        "filings_per_second": latest_batch.filings_per_second if latest_batch else None,
        "holdings_per_second": latest_batch.holdings_per_second if latest_batch else None,
        "peak_rss_mb_per_worker": latest_batch.peak_rss_mb_per_worker if latest_batch else None,
        "recent_filings": recent,
    }


@app.get("/batch/latest")
def get_latest_batch() -> dict:
    for job in reversed(list(_jobs.values())):
        batch = job.get("batch")
        if batch is not None:
            return {"has_data": True, "batch": batch.model_dump(mode="json")}
    return {"has_data": False, "batch": None}


@app.get("/rules")
def get_rules() -> dict:
    return {
        "rules": [
            {
                "rule_id": rule.rule_id,
                "description": rule.description,
                "severity": rule.severity,
                "spec_clause": rule.spec_clause,
                "schema_elements": list(rule.schema_elements),
                "scope": rule.scope,
                "status": rule.status,
            }
            for rule in RULES
        ]
    }


@app.post("/filings")
async def create_filing(request: Request) -> dict[str, str]:
    filename, content = await _extract_upload(request)
    suffix = Path(filename).suffix.lower()
    if suffix not in {".csv", ".json", ".xml", ".dta"}:
        raise HTTPException(status_code=400, detail="expected .csv, .json, .xml, or .dta upload")
    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    job_id = str(uuid4())
    try:
        filing = load_filing(tmp_path)
        summary = validate_filing(filing)
    except ParseError as exc:
        _jobs[job_id] = {"status": "failed", "error": str(exc), "path": str(tmp_path)}
        return {"id": job_id, "status": "failed"}

    _jobs[job_id] = {
        "status": "complete",
        "path": str(tmp_path),
        "filename": filename,
        "filing": filing,
        "summary": summary,
    }
    return {"id": job_id, "status": "complete"}


@app.get("/filings/{filing_id}")
def get_filing(filing_id: str) -> dict:
    job = _get_job(filing_id)
    summary = job.get("summary")
    if summary is None:
        return {"id": filing_id, "status": job["status"], "error": job.get("error")}
    return {
        "id": filing_id,
        "status": job["status"],
        "counts": {
            "holdings": summary.total_holdings,
            "errors": summary.errors,
            "warnings": summary.warnings,
            "conformance_percent": 100.0 if summary.passed else 0.0,
        },
    }


@app.get("/filings/{filing_id}/holdings")
def get_holdings(filing_id: str, offset: int = 0, limit: int = 100) -> dict:
    filing = _get_filing_model(filing_id)
    rows = filing.holdings[offset : offset + limit]
    return {
        "total": len(filing.holdings),
        "offset": offset,
        "limit": limit,
        "rows": [row.model_dump(mode="json") for row in rows],
    }


@app.get("/filings/{filing_id}/report")
def get_report(filing_id: str) -> dict:
    job = _get_job(filing_id)
    summary = job.get("summary")
    if summary is None:
        return {"status": job["status"], "error": job.get("error")}
    grouped: dict[str, list[dict]] = {}
    for violation in summary.violations:
        grouped.setdefault(violation.rule_id, []).append(violation.model_dump(mode="json"))
    return {
        "status": job["status"],
        "passed": summary.passed,
        "errors": summary.errors,
        "warnings": summary.warnings,
        "failures_by_rule": grouped,
    }


@app.get("/filings/{filing_id}/xml")
def get_xml(filing_id: str) -> Response:
    filing = _get_filing_model(filing_id)
    summary = _get_job(filing_id)["summary"]
    if not summary.passed:
        raise HTTPException(status_code=409, detail="XML is only available for filings with zero Tier-2 errors")
    try:
        xml = assert_round_trip_stable(filing)
    except SecXmlGenerationUnavailable as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    return Response(content=xml, media_type="application/xml")


@app.post("/batch")
def create_batch(request: BatchRequest) -> dict:
    batch_id = str(uuid4())
    result = run_batch(request.paths, workers=request.workers, cache_path=request.cache_path)
    _jobs[batch_id] = {"status": "complete", "batch": result}
    return {"id": batch_id, "status": "complete"}


@app.get("/batch/{batch_id}")
def get_batch(batch_id: str) -> dict:
    job = _get_job(batch_id)
    batch = job.get("batch")
    if batch is None:
        raise HTTPException(status_code=404, detail="batch not found")
    return batch.model_dump(mode="json")


def _get_job(job_id: str) -> dict:
    try:
        return _jobs[job_id]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="filing not found") from exc


def _get_filing_model(job_id: str) -> Filing:
    job = _get_job(job_id)
    filing = job.get("filing")
    if filing is None:
        raise HTTPException(status_code=409, detail="filing is not available")
    return filing


def _fund_label(filing: Filing) -> str:
    return (
        filing.header.series_id
        or filing.header.series_name
        or filing.header.series_lei
        or filing.header.registrant_name
        or "no data"
    )


def _dashboard_rule_flag_rates(
    filing_jobs: list[tuple[str, dict]],
    latest_batch,
    total_filings: int,
    total_holdings: int,
) -> list[dict]:
    flagged: dict[str, set[str]] = {rule.rule_id: set() for rule in RULES}
    for job_id, job in filing_jobs:
        summary = job["summary"]
        for index, violation in enumerate(summary.violations):
            holding_id = violation.holding_id
            key = f"{job_id}:{holding_id}" if holding_id else f"{job_id}:filing:{index}"
            flagged.setdefault(violation.rule_id, set()).add(key)

    if latest_batch is not None:
        for result in latest_batch.results:
            path = str(result.get("path", "<unknown>"))
            for index, violation in enumerate(result.get("violations", [])):
                rule_id = violation.get("rule_id")
                if rule_id not in flagged:
                    continue
                holding_id = violation.get("holding_id")
                key = f"{path}:{holding_id}" if holding_id else f"{path}:filing:{index}"
                flagged[rule_id].add(key)

    metrics: list[dict] = []
    for rule in RULES:
        if rule.status != "live":
            denominator = None
            rate = None
        else:
            denominator = total_holdings if rule.scope == "holding" else total_filings
            rate = (len(flagged[rule.rule_id]) / denominator) if denominator else None
        metrics.append(
            {
                "rule_id": rule.rule_id,
                "description": rule.description,
                "severity": rule.severity,
                "scope": rule.scope,
                "status": rule.status,
                "schema_elements": list(rule.schema_elements),
                "flagged": len(flagged.get(rule.rule_id, set())),
                "denominator": denominator,
                "flag_rate": rate,
            }
        )
    return metrics


async def _extract_upload(request: Request) -> tuple[str, bytes]:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        try:
            form = await request.form()
        except RuntimeError as exc:
            raise HTTPException(status_code=415, detail="python-multipart is required for form uploads") from exc
        upload = form.get("file")
        if upload is None or not hasattr(upload, "filename") or not hasattr(upload, "read"):
            raise HTTPException(status_code=400, detail="multipart upload requires a file field")
        return str(upload.filename), await upload.read()

    filename = request.headers.get("x-filename", "filing.csv")
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="request body is empty")
    return filename, body
