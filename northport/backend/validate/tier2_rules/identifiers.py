from __future__ import annotations

import re
from collections.abc import Iterable

from northport.backend.models import Filing, Holding, Provenance
from northport.backend.validate.results import Severity, Violation

_LEI_RE = re.compile(r"^[A-Z0-9]{18}[0-9]{2}$")
_CUSIP_RE = re.compile(r"^[0-9A-Z*@#]{9}$")
_ISIN_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")


def require_identifier(filing: Filing, holding: Holding | None) -> Iterable[Violation]:
    del filing
    assert holding is not None
    if holding.security_category.lower() in {"cash", "currency"}:
        return []
    identifiers = holding.identifiers
    if any([identifiers.lei, identifiers.cusip, identifiers.isin, identifiers.ticker, identifiers.other]):
        return []
    return [
        _violation(
            holding,
            "NP-ID-001",
            "holding must include at least one identifier",
            holding.field_provenance.get("lei", holding.provenance),
        )
    ]


def validate_identifier_formats(filing: Filing, holding: Holding | None) -> Iterable[Violation]:
    del filing
    assert holding is not None
    violations: list[Violation] = []
    ids = holding.identifiers
    if ids.lei and not _valid_lei(ids.lei):
        violations.append(
            _violation(holding, "NP-ID-002", "LEI failed ISO 17442 format/checksum validation", _field(holding, "lei"))
        )
    if ids.cusip and not _valid_cusip(ids.cusip):
        violations.append(
            _violation(holding, "NP-ID-002", "CUSIP failed format/check-digit validation", _field(holding, "cusip"))
        )
    if ids.isin and not _valid_isin(ids.isin):
        violations.append(
            _violation(holding, "NP-ID-002", "ISIN failed ISO 6166 format/check-digit validation", _field(holding, "isin"))
        )
    return violations


def _valid_lei(value: str) -> bool:
    if not _LEI_RE.match(value):
        return False
    numeric = "".join(str(ord(char) - 55) if char.isalpha() else char for char in value)
    return int(numeric) % 97 == 1


def _valid_cusip(value: str) -> bool:
    if not _CUSIP_RE.match(value):
        return False
    total = 0
    for index, char in enumerate(value[:8]):
        number = _cusip_value(char)
        if index % 2 == 1:
            number *= 2
        total += number // 10 + number % 10
    return (10 - (total % 10)) % 10 == int(value[8])


def _cusip_value(char: str) -> int:
    if char.isdigit():
        return int(char)
    if char == "*":
        return 36
    if char == "@":
        return 37
    if char == "#":
        return 38
    return ord(char) - 55


def _valid_isin(value: str) -> bool:
    if not _ISIN_RE.match(value):
        return False
    expanded = "".join(str(ord(char) - 55) if char.isalpha() else char for char in value)
    digits = [int(char) for char in expanded[::-1]]
    total = 0
    for index, digit in enumerate(digits):
        if index % 2 == 1:
            digit *= 2
        total += digit // 10 + digit % 10
    return total % 10 == 0


def _field(holding: Holding, field: str) -> Provenance:
    return holding.field_provenance.get(field, holding.provenance)


def _violation(holding: Holding, rule_id: str, message: str, provenance: Provenance) -> Violation:
    return Violation(
        rule_id=rule_id,
        severity=Severity.ERROR,
        message=message,
        provenance=provenance,
        holding_id=holding.holding_id,
    )
