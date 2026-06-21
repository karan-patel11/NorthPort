from __future__ import annotations

import argparse
import json
from pathlib import Path

from northport.backend.ingest.dta_adapter import DEFAULT_CHUNKSIZE, iter_dta_inspection


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect real GCAP .dta ingestion mappings.")
    parser.add_argument("path", type=Path, help="Path to the GCAP .dta slice")
    parser.add_argument("--accession-number", help="Limit inspection to one accession_number")
    parser.add_argument("--limit", type=int, default=10, help="Rows to print, between 5 and 10")
    parser.add_argument("--chunksize", type=int, default=DEFAULT_CHUNKSIZE)
    args = parser.parse_args()

    limit = max(5, min(args.limit, 10))
    for item in iter_dta_inspection(
        args.path,
        accession_number=args.accession_number,
        limit=limit,
        chunksize=args.chunksize,
    ):
        print(json.dumps(item, indent=2, sort_keys=True, default=str))


if __name__ == "__main__":
    main()
