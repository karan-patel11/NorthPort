from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from northport.backend.ingest.loaders import (
    ParseError,
    _header_from_mapping,
    _holding_from_mapping,
    _validation_message,
)
from northport.backend.models import Filing, Holding


DEFAULT_CHUNKSIZE = 50_000

GCAP_COLUMNS: tuple[str, ...] = (
    "accession_number",
    "holding_id",
    "currency_value",
    "quarter_report",
    "issuer_name",
    "issuer_lei",
    "issuer_title",
    "issuer_cusip",
    "balance",
    "unit",
    "other_unit_desc",
    "currency_code",
    "exchange_rate",
    "percentage",
    "payoff_profile",
    "asset_cat",
    "other_asset",
    "issuer_type",
    "other_issuer",
    "investment_country",
    "is_restricted_security",
    "fair_value_level",
    "derivative_cat",
    "filing_date",
    "report_ending_period",
    "report_date",
    "identifier_isin",
    "identifier_ticker",
    "other_identifier",
    "other_identifier_desc",
    "series_name",
    "series_id",
    "series_lei",
    "total_assets",
    "net_assets",
    "cik",
    "registrant_name",
    "file_num",
    "lei",
    "fund_key",
    "quarter_reference",
)


@dataclass(frozen=True)
class ColumnSpec:
    candidates: tuple[str, ...]
    required: bool = True
    derived: str | None = None
    confidence: str = "High"
    note: str | None = None


GCAP_FIELD_MAP: dict[str, ColumnSpec] = {
    "FilingHeader.registrant_cik": ColumnSpec(("cik",)),
    "FilingHeader.registrant_name": ColumnSpec(("registrant_name",), required=False),
    "FilingHeader.series_name": ColumnSpec(("series_name",), required=False),
    "FilingHeader.series_id": ColumnSpec(("series_id",), required=False),
    "FilingHeader.series_lei": ColumnSpec(("series_lei",), required=False),
    "FilingHeader.class_ids": ColumnSpec(
        (),
        required=False,
        derived="not present in verified GCAP slice",
        confidence="Low",
    ),
    "FilingHeader.report_period_end": ColumnSpec(
        ("report_date",),
        confidence="Medium",
        note="GCAP also contains report_ending_period; report_date is the N-PORT report date.",
    ),
    "FilingHeader.total_assets": ColumnSpec(("total_assets",)),
    "FilingHeader.total_liabilities": ColumnSpec(
        (),
        required=False,
        derived="total_assets - net_assets",
        confidence="Medium",
    ),
    "FilingHeader.net_assets": ColumnSpec(("net_assets",)),
    "Holding.holding_id": ColumnSpec(("holding_id",)),
    "Holding.issuer_name": ColumnSpec(("issuer_name", "issuer_title")),
    "Holding.identifiers.lei": ColumnSpec(
        ("issuer_lei",),
        required=False,
        note="Issuer-level N-PORT element issuerLei.",
    ),
    "Holding.identifiers.cusip": ColumnSpec(
        ("issuer_cusip",),
        required=False,
        note="Issuer-level N-PORT element issuerCusip.",
    ),
    "Holding.identifiers.isin": ColumnSpec(("identifier_isin",), required=False),
    "Holding.identifiers.ticker": ColumnSpec(("identifier_ticker",), required=False),
    "Holding.identifiers.other": ColumnSpec(("other_identifier",), required=False),
    "Holding.other_identifier_desc": ColumnSpec(("other_identifier_desc",), required=False),
    "Holding.security_type": ColumnSpec(
        ("issuer_title", "asset_cat"),
        confidence="Medium",
        note="Internal legacy field; GCAP has issuer_title, not a security_type column.",
    ),
    "Holding.security_category": ColumnSpec(("asset_cat",)),
    "Holding.balance": ColumnSpec(("balance",)),
    "Holding.units": ColumnSpec(("unit",)),
    "Holding.other_unit_desc": ColumnSpec(("other_unit_desc",), required=False),
    "Holding.currency": ColumnSpec(("currency_code",)),
    "Holding.value_usd": ColumnSpec(
        ("currency_value", "exchange_rate"),
        derived="currency_value for USD; currency_value / exchange_rate for non-USD",
        confidence="Medium",
    ),
    "Holding.percent_of_net_assets": ColumnSpec(("percentage",)),
    "Holding.payoff_profile": ColumnSpec(("payoff_profile",), required=False),
    "Holding.asset_category": ColumnSpec(("asset_cat",)),
    "Holding.other_asset": ColumnSpec(("other_asset",), required=False),
    "Holding.issuer_category": ColumnSpec(
        ("issuer_type",),
        confidence="Medium",
        note="GCAP issuer_type is the closest verified source column.",
    ),
    "Holding.other_issuer": ColumnSpec(("other_issuer",), required=False),
    "Holding.investment_country": ColumnSpec(("investment_country",), required=False),
    "Holding.is_restricted_security": ColumnSpec(("is_restricted_security",), required=False),
    "Holding.fair_value_level": ColumnSpec(
        ("fair_value_level",),
        required=False,
        derived="N/A when GCAP omits a fair-value level",
    ),
    "Holding.derivative_category": ColumnSpec(("derivative_cat",), required=False),
}

INSPECTION_SOURCE_COLUMNS: tuple[str, ...] = (
    "accession_number",
    "holding_id",
    "issuer_name",
    "issuer_lei",
    "issuer_cusip",
    "identifier_isin",
    "identifier_ticker",
    "currency_value",
    "currency_code",
    "exchange_rate",
    "percentage",
    "balance",
    "unit",
    "other_unit_desc",
    "asset_cat",
    "issuer_type",
    "payoff_profile",
    "derivative_cat",
    "is_restricted_security",
    "investment_country",
    "fair_value_level",
    "net_assets",
)


def load_dta_filing(
    path: str | Path,
    *,
    accession_number: str | None = None,
    chunksize: int = DEFAULT_CHUNKSIZE,
) -> Filing:
    """Load a single filing from a GCAP Stata slice without loading the whole file."""
    iterator = iter_dta_filings(path, accession_number=accession_number, chunksize=chunksize)
    try:
        filing = next(iterator)
    except StopIteration as exc:
        raise ParseError(f"{path}: no filing rows found in GCAP DTA") from exc

    if accession_number is None:
        try:
            next(iterator)
        except StopIteration:
            return filing
        raise ParseError(
            f"{path}: GCAP DTA contains multiple filings; pass accession_number="
            f"{_accession_from_source(filing.source)} or iterate with iter_dta_filings()"
        ) from None

    return filing


def iter_dta_filings(
    path: str | Path,
    *,
    accession_number: str | None = None,
    chunksize: int = DEFAULT_CHUNKSIZE,
) -> Iterator[Filing]:
    source = Path(path)
    current_accession: str | None = None
    current_header: dict[str, Any] | None = None
    current_holdings: list[Holding] = []
    flushed: set[str] = set()

    for row_number, raw_row in iter_dta_rows(source, chunksize=chunksize):
        row_accession = _text(raw_row, "accession_number")
        if accession_number is not None and row_accession != accession_number:
            continue

        if current_accession is None:
            current_accession = row_accession
            current_header = _map_header(raw_row, source=str(source), row_number=row_number)
        elif row_accession != current_accession:
            if row_accession in flushed:
                raise ParseError(
                    f"{source} row {row_number}: accession_number {row_accession!r} is not contiguous; "
                    "sort the GCAP slice by accession_number to stream filings safely"
                )
            assert current_header is not None
            yield _build_filing(
                source=source,
                accession_number=current_accession,
                header_row=current_header,
                holdings=current_holdings,
            )
            flushed.add(current_accession)
            current_accession = row_accession
            current_header = _map_header(raw_row, source=str(source), row_number=row_number)
            current_holdings = []

        mapped = _map_holding(raw_row, source=str(source), row_number=row_number)
        current_holdings.append(_holding_from_mapping(mapped, source=str(source), row_number=row_number))

    if current_accession is not None and current_header is not None:
        yield _build_filing(
            source=source,
            accession_number=current_accession,
            header_row=current_header,
            holdings=current_holdings,
        )


def iter_dta_rows(path: str | Path, *, chunksize: int = DEFAULT_CHUNKSIZE) -> Iterator[tuple[int, dict[str, Any]]]:
    """Yield lower-case GCAP DTA rows as dictionaries in bounded pyreadstat chunks."""
    source = Path(path)
    for row_offset, chunk in _read_dta_chunks(source, chunksize=chunksize):
        chunk.columns = [str(column).lower() for column in chunk.columns]
        _assert_verified_columns(tuple(chunk.columns), source)
        for index, record in enumerate(chunk.to_dict(orient="records"), start=1):
            yield row_offset + index, record


def iter_dta_inspection(
    path: str | Path,
    *,
    limit: int = 10,
    accession_number: str | None = None,
    chunksize: int = DEFAULT_CHUNKSIZE,
) -> Iterator[dict[str, Any]]:
    """Yield source/mapped row pairs for hand-verifying the GCAP adapter."""
    source = Path(path)
    emitted = 0
    for row_number, raw_row in iter_dta_rows(source, chunksize=chunksize):
        if accession_number is not None and _text(raw_row, "accession_number") != accession_number:
            continue
        header = _map_header(raw_row, source=str(source), row_number=row_number)
        holding = _map_holding(raw_row, source=str(source), row_number=row_number)
        yield {
            "row_number": row_number,
            "source": {column: _clean(raw_row.get(column)) for column in INSPECTION_SOURCE_COLUMNS},
            "mapped": {
                "registrant_cik": header["registrant_cik"],
                "registrant_name": header.get("registrant_name"),
                "series_id": header["series_id"],
                "series_lei": header.get("series_lei"),
                "report_period_end": header["report_period_end"],
                "net_assets": str(header["net_assets"]),
                "holding_id": holding["holding_id"],
                "issuer_name": holding["issuer_name"],
                "issuer_lei": holding.get("lei"),
                "issuer_cusip": holding.get("cusip"),
                "isin": holding.get("isin"),
                "ticker": holding.get("ticker"),
                "currency": holding["currency"],
                "value_usd": str(holding["value_usd"]) if holding["value_usd"] is not None else None,
                "percent_of_net_assets": str(holding["percent_of_net_assets"]),
                "units": holding["units"],
                "fair_value_level": holding["fair_value_level"],
                "derivative_category": holding.get("derivative_category"),
                "is_restricted_security": holding.get("is_restricted_security"),
                "investment_country": holding.get("investment_country"),
            },
            "medium_low_confidence_fields": _medium_low_confidence_fields(),
        }
        emitted += 1
        if emitted >= limit:
            return


def _read_dta_chunks(path: Path, *, chunksize: int) -> Iterator[tuple[int, Any]]:
    try:
        import pyreadstat
    except ImportError as exc:
        raise ParseError("pyreadstat is required to read GCAP .dta files") from exc

    if chunksize <= 0:
        raise ParseError("chunksize must be positive")

    row_offset = 0
    while True:
        frame, _metadata = pyreadstat.read_dta(
            str(path),
            row_limit=chunksize,
            row_offset=row_offset,
            dates_as_pandas_datetime=True,
        )
        if frame.empty:
            return
        yield row_offset, frame
        rows_read = len(frame)
        row_offset += rows_read
        if rows_read < chunksize:
            return


def _build_filing(
    *,
    source: Path,
    accession_number: str,
    header_row: dict[str, Any],
    holdings: list[Holding],
) -> Filing:
    try:
        header = _header_from_mapping(header_row, source=str(source))
        return Filing(
            header=header,
            holdings=holdings,
            source=f"{source}#accession_number={accession_number}",
        )
    except ValidationError as exc:
        raise ParseError(_validation_message(exc)) from exc


def _map_header(row: dict[str, Any], *, source: str, row_number: int) -> dict[str, Any]:
    total_assets = _required_decimal(row, "FilingHeader.total_assets", source, row_number)
    net_assets = _required_decimal(row, "FilingHeader.net_assets", source, row_number)
    return {
        "registrant_cik": _required_text(row, "FilingHeader.registrant_cik", source, row_number),
        "registrant_name": _optional_text(row, "FilingHeader.registrant_name"),
        "series_name": _optional_text(row, "FilingHeader.series_name"),
        "series_id": _optional_text(row, "FilingHeader.series_id"),
        "series_lei": _optional_text(row, "FilingHeader.series_lei"),
        "class_ids": [],
        "report_period_end": _required_date_text(
            row,
            "FilingHeader.report_period_end",
            source,
            row_number,
        ),
        "total_assets": total_assets,
        "net_assets": net_assets,
        "total_liabilities": total_assets - net_assets,
    }


def _map_holding(row: dict[str, Any], *, source: str, row_number: int) -> dict[str, Any]:
    currency = _optional_text(row, "Holding.currency")
    value_usd, value_path = _compute_value_usd(row, currency=currency, source=source, row_number=row_number)
    mapped: dict[str, Any] = {
        "holding_id": _required_text(row, "Holding.holding_id", source, row_number),
        "issuer_name": _required_text(row, "Holding.issuer_name", source, row_number),
        "lei": _optional_text(row, "Holding.identifiers.lei"),
        "cusip": _optional_text(row, "Holding.identifiers.cusip"),
        "isin": _optional_text(row, "Holding.identifiers.isin"),
        "ticker": _optional_text(row, "Holding.identifiers.ticker"),
        "other_identifier": _optional_text(row, "Holding.identifiers.other"),
        "other_identifier_desc": _optional_text(row, "Holding.other_identifier_desc"),
        "security_type": _required_text(row, "Holding.security_type", source, row_number),
        "security_category": _required_text(row, "Holding.security_category", source, row_number),
        "balance": _required_decimal(row, "Holding.balance", source, row_number),
        "units": _required_text(row, "Holding.units", source, row_number),
        "other_unit_desc": _optional_text(row, "Holding.other_unit_desc"),
        "currency": currency,
        "value_usd": value_usd,
        "percent_of_net_assets": _required_decimal(
            row,
            "Holding.percent_of_net_assets",
            source,
            row_number,
        ),
        "payoff_profile": _optional_text(row, "Holding.payoff_profile"),
        "asset_category": _required_text(row, "Holding.asset_category", source, row_number),
        "other_asset": _optional_text(row, "Holding.other_asset"),
        "issuer_category": _required_text(row, "Holding.issuer_category", source, row_number),
        "other_issuer": _optional_text(row, "Holding.other_issuer"),
        "investment_country": _optional_text(row, "Holding.investment_country"),
        "is_restricted_security": _optional_text(row, "Holding.is_restricted_security"),
        "fair_value_level": _fair_value_level(row),
        "derivative_category": _optional_text(row, "Holding.derivative_category"),
    }
    mapped["__field_paths__"] = {
        "holding_id": _selected_column(row, "Holding.holding_id"),
        "issuer_name": _selected_column(row, "Holding.issuer_name"),
        "lei": _selected_column(row, "Holding.identifiers.lei"),
        "cusip": _selected_column(row, "Holding.identifiers.cusip"),
        "isin": _selected_column(row, "Holding.identifiers.isin"),
        "ticker": _selected_column(row, "Holding.identifiers.ticker"),
        "other_identifier": _selected_column(row, "Holding.identifiers.other"),
        "other_identifier_desc": _selected_column(row, "Holding.other_identifier_desc"),
        "security_type": _selected_column(row, "Holding.security_type"),
        "security_category": _selected_column(row, "Holding.security_category"),
        "balance": _selected_column(row, "Holding.balance"),
        "units": _selected_column(row, "Holding.units"),
        "other_unit_desc": _selected_column(row, "Holding.other_unit_desc"),
        "currency": _selected_column(row, "Holding.currency"),
        "value_usd": value_path,
        "percent_of_net_assets": _selected_column(row, "Holding.percent_of_net_assets"),
        "payoff_profile": _selected_column(row, "Holding.payoff_profile"),
        "asset_category": _selected_column(row, "Holding.asset_category"),
        "other_asset": _selected_column(row, "Holding.other_asset"),
        "issuer_category": _selected_column(row, "Holding.issuer_category"),
        "other_issuer": _selected_column(row, "Holding.other_issuer"),
        "investment_country": _selected_column(row, "Holding.investment_country"),
        "is_restricted_security": _selected_column(row, "Holding.is_restricted_security"),
        "fair_value_level": _selected_column(row, "Holding.fair_value_level"),
        "derivative_category": _selected_column(row, "Holding.derivative_category"),
    }
    return mapped


def _compute_value_usd(
    row: dict[str, Any],
    *,
    currency: str | None,
    source: str,
    row_number: int,
) -> tuple[Decimal | None, str]:
    amount = _optional_raw_decimal(row, "currency_value", source, row_number)
    if amount is None:
        return None, "no-data:currency_value missing"
    rate_text = _clean(row.get("exchange_rate"))
    if currency is None:
        return None, "no-data:currency_code missing"
    currency_code = currency.upper()

    if currency_code == "USD":
        return amount, "derived:currency_value (USD identity; blank exchange_rate expected)"

    if rate_text is None:
        return None, "no-data:exchange_rate missing for non-USD currency_value"
    rate = _decimal_from_text(rate_text, source, row_number, "exchange_rate")
    if rate == 0:
        return None, "no-data:exchange_rate zero"
    return amount / rate, "derived:currency_value/exchange_rate"


def _required_text(row: dict[str, Any], internal_field: str, source: str, row_number: int) -> str:
    value = _pick(row, internal_field)
    text = _clean(value)
    if text is None:
        columns = ", ".join(GCAP_FIELD_MAP[internal_field].candidates)
        raise ParseError(f"{source} row {row_number}: missing required GCAP value for {internal_field} ({columns})")
    return text


def _required_date_text(row: dict[str, Any], internal_field: str, source: str, row_number: int) -> str:
    value = _pick(row, internal_field)
    text = _clean(value)
    if text is None:
        columns = ", ".join(GCAP_FIELD_MAP[internal_field].candidates)
        raise ParseError(f"{source} row {row_number}: missing required GCAP value for {internal_field} ({columns})")
    if hasattr(value, "date"):
        return value.date().isoformat()
    return text.split(" ", 1)[0]


def _optional_text(row: dict[str, Any], internal_field: str) -> str | None:
    return _clean(_pick(row, internal_field, required=False))


def _fair_value_level(row: dict[str, Any]) -> str:
    return _optional_text(row, "Holding.fair_value_level") or "N/A"


def _required_decimal(row: dict[str, Any], internal_field: str, source: str, row_number: int) -> Decimal:
    value = _required_text(row, internal_field, source, row_number)
    return _decimal_from_text(value, source, row_number, internal_field)


def _required_raw_decimal(row: dict[str, Any], column: str, source: str, row_number: int) -> Decimal:
    text = _clean(row.get(column))
    if text is None:
        raise ParseError(f"{source} row {row_number}: missing required GCAP value for {column}")
    return _decimal_from_text(text, source, row_number, column)


def _optional_raw_decimal(row: dict[str, Any], column: str, source: str, row_number: int) -> Decimal | None:
    text = _clean(row.get(column))
    if text is None:
        return None
    return _decimal_from_text(text, source, row_number, column)


def _decimal_from_text(text: str, source: str, row_number: int, field: str) -> Decimal:
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ParseError(f"{source} row {row_number}: {field} must be decimal") from exc


def _pick(row: dict[str, Any], internal_field: str, *, required: bool = True) -> Any:
    spec = GCAP_FIELD_MAP[internal_field]
    for candidate in spec.candidates:
        if candidate in row and _clean(row[candidate]) is not None:
            return row[candidate]
    if required and spec.required:
        return None
    return None


def _selected_column(row: dict[str, Any], internal_field: str) -> str | None:
    spec = GCAP_FIELD_MAP[internal_field]
    for candidate in spec.candidates:
        if candidate in row and _clean(row[candidate]) is not None:
            return candidate
    return f"derived:{spec.derived}" if spec.derived else None


def _text(row: dict[str, Any], column: str) -> str:
    value = _clean(row.get(column))
    if value is None:
        raise ParseError(f"GCAP DTA row is missing required grouping column '{column}'")
    return value


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    try:
        import pandas as pd

        if pd.isna(value):
            return None
    except (ImportError, TypeError, ValueError):
        pass
    text = str(value).strip()
    if not text or text.lower() in {"nan", "nat", "<na>", "none"}:
        return None
    return text


def _assert_verified_columns(actual_columns: tuple[str, ...], source: Path) -> None:
    actual = set(actual_columns)
    expected = set(GCAP_COLUMNS)
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    if missing or extra:
        details = []
        if missing:
            details.append(f"missing: {', '.join(missing)}")
        if extra:
            details.append(f"unexpected: {', '.join(extra)}")
        raise ParseError(
            f"{source}: GCAP DTA columns do not match the verified 41-column contract ({'; '.join(details)})"
        )


def _medium_low_confidence_fields() -> list[dict[str, str]]:
    flagged: list[dict[str, str]] = []
    for field, spec in GCAP_FIELD_MAP.items():
        if spec.confidence in {"Medium", "Low"}:
            flagged.append(
                {
                    "field": field,
                    "confidence": spec.confidence,
                    "source": ", ".join(spec.candidates) if spec.candidates else f"derived:{spec.derived}",
                    "note": spec.note or "",
                }
            )
    return flagged


def _accession_from_source(source: str | None) -> str:
    if not source or "#accession_number=" not in source:
        return "<accession_number>"
    return repr(source.rsplit("#accession_number=", 1)[1])
