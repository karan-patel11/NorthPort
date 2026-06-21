from __future__ import annotations

import os
import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

import pytest

from northport.backend.ingest import iter_dta_filings
from northport.backend.ingest.dta_adapter import _map_holding, iter_dta_rows
from northport.backend.validate import validate_filing
from northport.backend.validate.tier1_xsd import SchemaValidationError, resolve_schema_path, validate_xml

FIXTURES = Path(__file__).parent / "fixtures"
DEFAULT_GCAP = Path("/Users/karanpatel/Downloads/gcap_slice/2025q4.dta")
REPO_ROOT = Path(__file__).resolve().parents[3]
INFINITY_NEGATIVE_FIXTURE = "infinity_2021q4.xml"
CCC_FIXTURE_VALUE = "TEST#123"
DELTA_REDACTION_VALUE = "N/A"
DELTA_REDACTION_RE = re.compile(r"X{2,}", re.IGNORECASE)


@dataclass(frozen=True)
class NormalizedEdgarFixture:
    xml: bytes
    ccc_placeholders: tuple[str, ...]
    delta_placeholders: tuple[str, ...]
    has_irreducible_var_info_redaction: bool


def _gcap_fixture() -> Path | None:
    configured = os.environ.get("NORTHPORT_GCAP_DTA_FIXTURE")
    if configured:
        return Path(configured)
    return DEFAULT_GCAP if DEFAULT_GCAP.exists() else None


def test_real_gcap_dta_fixture_streams_to_validated_model_rows():
    fixture = _gcap_fixture()
    if fixture is None or not fixture.exists():
        pytest.skip("real GCAP .dta fixture not supplied")

    filing = next(iter_dta_filings(
        fixture,
        accession_number=os.environ.get("NORTHPORT_GCAP_ACCESSION_NUMBER"),
        chunksize=int(os.environ.get("NORTHPORT_GCAP_CHUNKSIZE", "1000")),
    ))
    summary = validate_filing(filing)

    assert filing.holdings
    assert filing.header.registrant_cik
    assert filing.header.series_id
    assert filing.header.net_assets is not None
    assert summary.total_holdings == len(filing.holdings)
    first = filing.holdings[0]
    assert first.holding_id
    assert first.currency
    assert first.field_provenance["currency"].field_path == "currency_code"
    assert first.field_provenance["units"].field_path == "unit"
    assert first.field_provenance["percent_of_net_assets"].field_path == "percentage"
    assert first.liquidity_classification is None


def test_real_gcap_fx_conversion_invariants():
    fixture = _gcap_fixture()
    if fixture is None or not fixture.exists():
        pytest.skip("real GCAP .dta fixture not supplied")

    usd_checked = 0
    non_usd_checked = False
    for row_number, row in iter_dta_rows(fixture, chunksize=1000):
        currency = _clean(row.get("currency_code"))
        amount = _decimal(row.get("currency_value"))
        if currency is None or amount is None:
            continue

        mapped = _map_holding(row, source=str(fixture), row_number=row_number)
        if currency.upper() == "USD":
            assert mapped["value_usd"] == amount
            usd_checked += 1
        elif not non_usd_checked:
            rate = _decimal(row.get("exchange_rate"))
            if rate is not None and rate != 0:
                assert mapped["value_usd"] == amount / rate
                non_usd_checked = True

        if usd_checked >= 100 and non_usd_checked:
            break

    assert usd_checked >= 100
    assert non_usd_checked


def test_real_edgar_xml_fixtures_validate_against_pinned_xsd():
    schema_path = resolve_schema_path()
    skipped_redacted_var_info: list[str] = []
    validated_fixtures: list[str] = []

    for xml_path in _edgar_xml_fixtures():
        if xml_path.name == INFINITY_NEGATIVE_FIXTURE:
            continue

        normalized = _load_normalized_edgar_fixture(xml_path)
        if normalized.has_irreducible_var_info_redaction:
            skipped_redacted_var_info.append(xml_path.name)
            continue

        validate_xml(normalized.xml, xsd_path=schema_path)
        validated_fixtures.append(xml_path.name)

    if skipped_redacted_var_info:
        skipped = ", ".join(skipped_redacted_var_info)
        pytest.skip(
            "excluded irreducibly redacted EDGAR fixture(s) from the positive XSD set; "
            f"varInfo is present but missing required medianDailyVarPct: {skipped}"
        )
    if not validated_fixtures:
        pytest.skip("no positive EDGAR N-PORT XML fixtures supplied")


def test_real_edgar_xml_truncated_infinity_fixture_fails_tier1():
    if not os.environ.get("NORTHPORT_EDGAR_DIR"):
        pytest.skip("NORTHPORT_EDGAR_DIR not supplied")
    schema_path = resolve_schema_path()
    xml_path = _infinity_negative_fixture()
    if xml_path is None:
        pytest.skip(f"{INFINITY_NEGATIVE_FIXTURE} negative fixture not supplied")

    normalized = _load_normalized_edgar_fixture(xml_path)
    with pytest.raises(SchemaValidationError) as excinfo:
        validate_xml(normalized.xml, xsd_path=schema_path)

    assert "documents" in str(excinfo.value)


def _edgar_xml_fixtures() -> list[Path]:
    edgar_dir = os.environ.get("NORTHPORT_EDGAR_DIR")
    if not edgar_dir:
        pytest.skip("NORTHPORT_EDGAR_DIR not supplied")

    xml_fixtures = sorted(Path(edgar_dir).glob("*.xml"))
    if not xml_fixtures:
        pytest.skip("real EDGAR N-PORT XML fixtures not supplied")
    return xml_fixtures


def _infinity_negative_fixture() -> Path | None:
    configured_dir = os.environ.get("NORTHPORT_EDGAR_DIR")
    candidates = []
    if configured_dir:
        candidates.append(Path(configured_dir) / INFINITY_NEGATIVE_FIXTURE)
    candidates.append(
        REPO_ROOT / "backend" / "tests" / "fixtures" / "edgar" / INFINITY_NEGATIVE_FIXTURE
    )

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _load_normalized_edgar_fixture(xml_path: Path) -> NormalizedEdgarFixture:
    from lxml import etree

    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    document = etree.fromstring(xml_path.read_bytes(), parser=parser)
    ccc_placeholders: list[str] = []
    delta_placeholders: list[str] = []

    for element in document.iter():
        name = _local_name(element)
        if name == "ccc":
            value = (element.text or "").strip()
            if value and len(value) != 8:
                # SEC sample/public fixtures can carry demonstration or redacted CCC values
                # with the wrong length; production validation remains strict.
                ccc_placeholders.append(value)
                element.text = CCC_FIXTURE_VALUE
        elif name == "delta":
            value = (element.text or "").strip()
            if DELTA_REDACTION_RE.fullmatch(value):
                # Public-dissemination filings redact derivative deltas as XXXX; the
                # pinned v1.13 union type accepts the N/A sentinel for these fields.
                delta_placeholders.append(value)
                element.text = DELTA_REDACTION_VALUE

    return NormalizedEdgarFixture(
        xml=etree.tostring(document),
        ccc_placeholders=tuple(ccc_placeholders),
        delta_placeholders=tuple(delta_placeholders),
        has_irreducible_var_info_redaction=_has_irreducible_var_info_redaction(document),
    )


def _has_irreducible_var_info_redaction(document) -> bool:
    for element in document.iter():
        if _local_name(element) != "varInfo":
            continue
        child_names = [
            name
            for descendant in element.iterdescendants()
            if (name := _local_name(descendant)) is not None
        ]
        if not child_names:
            return True
    return False


def _local_name(element) -> str | None:
    tag = element.tag
    if not isinstance(tag, str):
        return None
    return tag.rsplit("}", 1)[-1]


def _clean(value) -> str | None:
    text = str(value).strip() if value is not None else ""
    if not text or text.lower() in {"nan", "nat", "<na>", "none"}:
        return None
    return text


def _decimal(value) -> Decimal | None:
    text = _clean(value)
    if text is None:
        return None
    return Decimal(text)
