from pathlib import Path

import pytest

from northport.backend.ingest import ParseError, load_filing, parse_json

FIXTURES = Path(__file__).parent / "fixtures"


def test_csv_ingestion_preserves_header_and_provenance():
    filing = load_filing(FIXTURES / "sample_filing.csv")

    assert filing.header.registrant_cik == "0001067983"
    assert filing.header.class_ids == ["CL0001", "CL0002"]
    assert len(filing.holdings) == 2
    assert filing.holdings[0].provenance.row_number == 2
    assert filing.holdings[0].identifiers.cusip == "037833100"


def test_json_ingestion_requires_header_and_holdings():
    with pytest.raises(ParseError, match="requires a holdings array"):
        parse_json('{"header": {}}')


def test_csv_rejects_missing_required_columns(tmp_path):
    path = tmp_path / "missing.csv"
    path.write_text("holding_id,issuer_name\n1,Issuer\n")

    with pytest.raises(ParseError, match="missing required fields"):
        load_filing(path)

