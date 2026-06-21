from __future__ import annotations

import csv
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable

from pydantic import ValidationError

from northport.backend.models import Filing, FilingHeader, Holding, IdentifierSet, Provenance
from northport.backend.validate.tier1_xsd import SchemaUnavailableError, SchemaValidationError, validate_xml


class ParseError(ValueError):
    """Raised when source data is malformed or incomplete."""


HEADER_FIELDS = {
    "registrant_cik",
    "series_id",
    "report_period_end",
    "total_assets",
    "total_liabilities",
    "net_assets",
}

HOLDING_FIELDS = {
    "holding_id",
    "issuer_name",
    "security_type",
    "security_category",
    "balance",
    "units",
    "currency",
    "value_usd",
    "percent_of_net_assets",
    "payoff_profile",
    "asset_category",
    "issuer_category",
    "fair_value_level",
}

IDENTIFIER_FIELDS = {"lei", "cusip", "isin", "ticker", "other_identifier"}


def load_filing(path: str | Path) -> Filing:
    source = Path(path)
    suffix = source.suffix.lower()
    data = source.read_bytes()
    if suffix == ".csv":
        return parse_csv(data, source=str(source))
    if suffix == ".json":
        return parse_json(data, source=str(source))
    if suffix == ".xml":
        return parse_xml(data, source=str(source))
    if suffix == ".dta":
        from northport.backend.ingest.dta_adapter import load_dta_filing

        return load_dta_filing(source)
    raise ParseError(f"unsupported input type '{suffix}'; expected .csv, .json, .xml, or .dta")


def parse_csv(content: bytes | str, *, source: str = "<csv>") -> Filing:
    text = content.decode("utf-8-sig") if isinstance(content, bytes) else content
    reader = csv.DictReader(text.splitlines())
    if reader.fieldnames is None:
        raise ParseError("CSV is empty or missing a header row")

    fields = {field.strip() for field in reader.fieldnames if field is not None}
    _require_fields(fields, HEADER_FIELDS | HOLDING_FIELDS, source)

    rows = list(reader)
    if not rows:
        raise ParseError("CSV contains no holdings")

    header = _header_from_mapping(rows[0], source=source)
    holdings = [_holding_from_mapping(row, source=source, row_number=index + 2) for index, row in enumerate(rows)]
    return Filing(header=header, holdings=holdings, source=source)


def parse_json(content: bytes | str, *, source: str = "<json>") -> Filing:
    text = content.decode("utf-8") if isinstance(content, bytes) else content
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ParseError(f"invalid JSON at line {exc.lineno}: {exc.msg}") from exc

    if not isinstance(payload, dict):
        raise ParseError("JSON filing must be an object with header and holdings")
    if not isinstance(payload.get("header"), dict):
        raise ParseError("JSON filing requires a header object")
    if not isinstance(payload.get("holdings"), list):
        raise ParseError("JSON filing requires a holdings array")

    header_fields = set(payload["header"].keys())
    _require_fields(header_fields, HEADER_FIELDS, source)

    holdings = []
    for index, item in enumerate(payload["holdings"], start=1):
        if not isinstance(item, dict):
            raise ParseError(f"holding {index} must be an object")
        _require_fields(set(item.keys()), HOLDING_FIELDS, f"{source}:holdings[{index}]")
        holdings.append(_holding_from_mapping(item, source=source, row_number=index))

    try:
        return Filing(
            header=FilingHeader(**payload["header"]),
            holdings=holdings,
            monthly_returns=payload.get("monthly_returns", []),
            source=source,
        )
    except ValidationError as exc:
        raise ParseError(_validation_message(exc)) from exc


def parse_xml(content: bytes | str, *, source: str = "<xml>") -> Filing:
    xml = content if isinstance(content, bytes) else content.encode("utf-8")
    try:
        validate_xml(xml)
    except (SchemaUnavailableError, SchemaValidationError) as exc:
        raise ParseError(f"{source}: Tier-1 XML validation failed: {exc}") from exc
    raise ParseError(
        f"{source}: raw SEC N-PORT XML field mapping is gated on docs/field_mapping.md and the pinned schema"
    )


def _require_fields(actual: set[str], required: Iterable[str], source: str) -> None:
    missing = sorted(field for field in required if field not in actual)
    if missing:
        raise ParseError(f"{source} missing required fields: {', '.join(missing)}")


def _header_from_mapping(row: dict[str, Any], *, source: str) -> FilingHeader:
    values = {
        field: _required(row, field, source=source)
        for field in HEADER_FIELDS
        if field != "series_id"
    }
    values["series_id"] = _optional(row, "series_id")
    if "class_ids" in row:
        values["class_ids"] = row.get("class_ids")
    if "registrant_name" in row:
        values["registrant_name"] = _optional(row, "registrant_name")
    if "series_name" in row:
        values["series_name"] = _optional(row, "series_name")
    if "series_lei" in row:
        values["series_lei"] = _optional(row, "series_lei")
    try:
        return FilingHeader(**values)
    except ValidationError as exc:
        raise ParseError(_validation_message(exc)) from exc


def _holding_from_mapping(row: dict[str, Any], *, source: str, row_number: int) -> Holding:
    provenance = Provenance(source=source, row_number=row_number)
    external_field_paths = row.get("__field_paths__", {})
    field_provenance = {
        field: Provenance(
            source=source,
            row_number=row_number,
            field_path=external_field_paths.get(field, field),
        )
        for field in set(row.keys()) | HOLDING_FIELDS | IDENTIFIER_FIELDS
        if field != "__field_paths__"
    }
    identifiers = IdentifierSet(
        lei=_optional(row, "lei"),
        cusip=_optional(row, "cusip"),
        isin=_optional(row, "isin"),
        ticker=_optional(row, "ticker"),
        other=_optional(row, "other_identifier"),
    )
    values = {
        "holding_id": _required(row, "holding_id", source=source, row_number=row_number),
        "issuer_name": _required(row, "issuer_name", source=source, row_number=row_number),
        "identifiers": identifiers,
        "security_type": _required(row, "security_type", source=source, row_number=row_number),
        "security_category": _required(row, "security_category", source=source, row_number=row_number),
        "balance": _decimal(row, "balance", source=source, row_number=row_number),
        "units": _required(row, "units", source=source, row_number=row_number),
        "other_unit_desc": _optional(row, "other_unit_desc"),
        "currency": _optional(row, "currency"),
        "value_usd": _optional_decimal(row, "value_usd", source=source, row_number=row_number),
        "percent_of_net_assets": _decimal(
            row, "percent_of_net_assets", source=source, row_number=row_number
        ),
        "payoff_profile": _optional(row, "payoff_profile"),
        "asset_category": _required(row, "asset_category", source=source, row_number=row_number),
        "other_asset": _optional(row, "other_asset"),
        "issuer_category": _required(row, "issuer_category", source=source, row_number=row_number),
        "other_issuer": _optional(row, "other_issuer"),
        "investment_country": _optional(row, "investment_country"),
        "is_restricted_security": _optional(row, "is_restricted_security"),
        "fair_value_level": _optional(row, "fair_value_level"),
        "liquidity_classification": _optional(row, "liquidity_classification"),
        "derivative_category": _optional(row, "derivative_category"),
        "other_identifier_desc": _optional(row, "other_identifier_desc"),
        "provenance": provenance,
        "field_provenance": field_provenance,
    }

    if _optional(row, "derivative_type"):
        values["derivative_detail"] = {
            "derivative_type": _optional(row, "derivative_type"),
            "notional_usd": _optional_decimal(row, "notional_usd", source=source, row_number=row_number),
            "counterparty": _optional(row, "counterparty"),
        }

    try:
        return Holding(**values)
    except ValidationError as exc:
        raise ParseError(_validation_message(exc)) from exc


def _required(row: dict[str, Any], field: str, *, source: str, row_number: int | None = None) -> str:
    value = row.get(field)
    text = str(value).strip() if value is not None else ""
    if not text:
        location = f"{source} row {row_number}" if row_number is not None else source
        raise ParseError(f"{location}: required field '{field}' is blank")
    return text


def _optional(row: dict[str, Any], field: str) -> str | None:
    value = row.get(field)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _decimal(row: dict[str, Any], field: str, *, source: str, row_number: int) -> Decimal:
    value = _required(row, field, source=source, row_number=row_number)
    try:
        return Decimal(value)
    except InvalidOperation as exc:
        raise ParseError(f"{source} row {row_number}: field '{field}' must be decimal") from exc


def _optional_decimal(
    row: dict[str, Any], field: str, *, source: str, row_number: int
) -> Decimal | None:
    value = _optional(row, field)
    if value is None:
        return None
    try:
        return Decimal(value)
    except InvalidOperation as exc:
        raise ParseError(f"{source} row {row_number}: field '{field}' must be decimal") from exc


def _validation_message(exc: ValidationError) -> str:
    first = exc.errors()[0]
    loc = ".".join(str(part) for part in first["loc"])
    return f"{loc}: {first['msg']}"
