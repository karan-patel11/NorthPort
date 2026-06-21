from __future__ import annotations

from pathlib import Path
import resource
from time import perf_counter

from northport.backend.harness.cache import ContentHashCache, content_hash_file
from northport.backend.ingest import load_filing
from northport.backend.validate import validate_filing


def process_filing(path: str, cache_path: str | None = None) -> dict:
    started = perf_counter()
    source = Path(path)
    digest = content_hash_file(source)

    cache = ContentHashCache(cache_path) if cache_path else None
    cached = cache.get(digest) if cache else None
    if cached:
        cached["cache_hit"] = True
        return cached

    filing = load_filing(source)
    summary = validate_filing(filing)
    elapsed = perf_counter() - started
    holdings = len(filing.holdings)
    result = {
        "path": str(source),
        "hash": digest,
        "cache_hit": False,
        "holdings": holdings,
        "errors": summary.errors,
        "warnings": summary.warnings,
        "passed": summary.passed,
        "elapsed_seconds": elapsed,
        "holdings_per_second": holdings / max(elapsed, 0.000001),
        "peak_rss_mb": _peak_rss_mb(),
        "violations": [item.model_dump(mode="json") for item in summary.violations],
    }
    if cache:
        cache.put(digest, result)
    return result


def _peak_rss_mb() -> float:
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # macOS reports bytes; Linux reports KiB.
    if peak > 10_000_000:
        return peak / (1024 * 1024)
    return peak / 1024
