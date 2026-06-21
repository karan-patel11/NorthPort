from pathlib import Path

from northport.backend.harness import ContentHashCache, content_hash, run_batch

FIXTURES = Path(__file__).parent / "fixtures"


def test_content_hash_cache_round_trips_json(tmp_path):
    cache = ContentHashCache(tmp_path / "cache.sqlite")
    digest = content_hash(b"abc")
    cache.put(digest, {"passed": True})

    assert cache.get(digest) == {"passed": True}


def test_batch_uses_cache_on_second_run(tmp_path):
    cache_path = tmp_path / "cache.sqlite"
    path = FIXTURES / "sample_filing.csv"

    first = run_batch([path], workers=1, cache_path=str(cache_path))
    second = run_batch([path], workers=1, cache_path=str(cache_path))

    assert first.total_filings == 1
    assert first.cache_hits == 0
    assert second.cache_hits == 1
    assert second.passed_filings == 1

