from __future__ import annotations

from multiprocessing import Pool
import os
from pathlib import Path
from time import perf_counter

from pydantic import BaseModel

from northport.backend.harness.worker import process_filing
from northport.backend.validate.registry import RULES


class BatchResult(BaseModel):
    elapsed_seconds: float
    worker_count: int | None
    total_filings: int
    passed_filings: int
    failed_filings: int
    cache_hits: int
    total_holdings: int
    filings_per_second: float
    holdings_per_second: float
    peak_rss_mb_per_worker: float | None
    rule_flag_rates: list[dict]
    results: list[dict]


def run_batch(paths: list[str | Path], *, workers: int | None = None, cache_path: str | None = None) -> BatchResult:
    started = perf_counter()
    args = [(str(path), cache_path) for path in paths]
    worker_count = workers if workers is not None else os.cpu_count()
    if not args:
        return BatchResult(
            elapsed_seconds=0.0,
            worker_count=worker_count,
            total_filings=0,
            passed_filings=0,
            failed_filings=0,
            cache_hits=0,
            total_holdings=0,
            filings_per_second=0.0,
            holdings_per_second=0.0,
            peak_rss_mb_per_worker=None,
            rule_flag_rates=_rule_flag_rates([], 0, 0),
            results=[],
        )

    if workers == 1:
        results = [process_filing(path, cache_path) for path, cache_path in args]
    else:
        with Pool(processes=workers) as pool:
            results = pool.starmap(process_filing, args)

    elapsed = max(perf_counter() - started, 0.000001)
    passed = sum(1 for result in results if result["passed"])
    holdings = sum(int(result.get("holdings", 0)) for result in results)
    peak_values = [
        float(result["peak_rss_mb"])
        for result in results
        if result.get("peak_rss_mb") is not None and not result.get("cache_hit")
    ]
    return BatchResult(
        elapsed_seconds=elapsed,
        worker_count=worker_count,
        total_filings=len(results),
        passed_filings=passed,
        failed_filings=len(results) - passed,
        cache_hits=sum(1 for result in results if result.get("cache_hit")),
        total_holdings=holdings,
        filings_per_second=len(results) / elapsed,
        holdings_per_second=holdings / elapsed,
        peak_rss_mb_per_worker=max(peak_values) if peak_values else None,
        rule_flag_rates=_rule_flag_rates(results, len(results), holdings),
        results=results,
    )


def _rule_flag_rates(results: list[dict], total_filings: int, total_holdings: int) -> list[dict]:
    flagged: dict[str, set[str]] = {rule.rule_id: set() for rule in RULES}
    for result in results:
        path = str(result.get("path", "<unknown>"))
        for index, violation in enumerate(result.get("violations", [])):
            rule_id = violation.get("rule_id")
            if rule_id not in flagged:
                continue
            holding_id = violation.get("holding_id")
            key = f"{path}:{holding_id}" if holding_id else f"{path}:filing:{index}"
            flagged[rule_id].add(key)

    rates: list[dict] = []
    for rule in RULES:
        if rule.status != "live":
            denominator = None
            rate = None
        else:
            denominator = total_holdings if rule.scope == "holding" else total_filings
            rate = (len(flagged[rule.rule_id]) / denominator) if denominator else None
        rates.append(
            {
                "rule_id": rule.rule_id,
                "description": rule.description,
                "severity": rule.severity,
                "scope": rule.scope,
                "status": rule.status,
                "schema_elements": list(rule.schema_elements),
                "flagged": len(flagged[rule.rule_id]),
                "denominator": denominator,
                "flag_rate": rate,
            }
        )
    return rates
