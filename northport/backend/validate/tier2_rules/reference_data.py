from __future__ import annotations

from collections.abc import Iterable
from northport.backend.models import Filing, Holding
from northport.backend.validate.results import Severity, Violation

ISO_4217_CODES = {
    "AED",
    "AFN",
    "ALL",
    "AMD",
    "ANG",
    "AOA",
    "ARS",
    "AUD",
    "AWG",
    "AZN",
    "BAM",
    "BBD",
    "BDT",
    "BGN",
    "BHD",
    "BIF",
    "BMD",
    "BND",
    "BOB",
    "BRL",
    "BSD",
    "BTN",
    "BWP",
    "BYN",
    "BZD",
    "CAD",
    "CDF",
    "CHF",
    "CLP",
    "CNY",
    "COP",
    "CRC",
    "CUP",
    "CVE",
    "CZK",
    "DJF",
    "DKK",
    "DOP",
    "DZD",
    "EGP",
    "ERN",
    "ETB",
    "EUR",
    "FJD",
    "FKP",
    "GBP",
    "GEL",
    "GHS",
    "GIP",
    "GMD",
    "GNF",
    "GTQ",
    "GYD",
    "HKD",
    "HNL",
    "HTG",
    "HUF",
    "IDR",
    "ILS",
    "INR",
    "IQD",
    "IRR",
    "ISK",
    "JMD",
    "JOD",
    "JPY",
    "KES",
    "KGS",
    "KHR",
    "KMF",
    "KPW",
    "KRW",
    "KWD",
    "KYD",
    "KZT",
    "LAK",
    "LBP",
    "LKR",
    "LRD",
    "LSL",
    "LYD",
    "MAD",
    "MDL",
    "MGA",
    "MKD",
    "MMK",
    "MNT",
    "MOP",
    "MRU",
    "MUR",
    "MVR",
    "MWK",
    "MXN",
    "MYR",
    "MZN",
    "NAD",
    "NGN",
    "NIO",
    "NOK",
    "NPR",
    "NZD",
    "OMR",
    "PAB",
    "PEN",
    "PGK",
    "PHP",
    "PKR",
    "PLN",
    "PYG",
    "QAR",
    "RON",
    "RSD",
    "RUB",
    "RWF",
    "SAR",
    "SBD",
    "SCR",
    "SDG",
    "SEK",
    "SGD",
    "SHP",
    "SLE",
    "SOS",
    "SRD",
    "SSP",
    "STN",
    "SYP",
    "SZL",
    "THB",
    "TJS",
    "TMT",
    "TND",
    "TOP",
    "TRY",
    "TTD",
    "TWD",
    "TZS",
    "UAH",
    "UGX",
    "USD",
    "UYU",
    "UZS",
    "VES",
    "VND",
    "VUV",
    "WST",
    "XAF",
    "XCD",
    "XOF",
    "XPF",
    "YER",
    "ZAR",
    "ZMW",
    "ZWL",
}

FAIR_VALUE_LEVELS = {"1", "2", "3", "N/A"}


def validate_currency_and_value(filing: Filing, holding: Holding | None) -> Iterable[Violation]:
    del filing
    assert holding is not None
    violations: list[Violation] = []
    if not holding.currency:
        violations.append(
            Violation(
                rule_id="NP-REF-001",
                severity=Severity.ERROR,
                message="currency_code is missing; USD value is no data",
                provenance=holding.field_provenance.get("currency", holding.provenance),
                holding_id=holding.holding_id,
            )
        )
    elif holding.currency not in ISO_4217_CODES:
        violations.append(
            Violation(
                rule_id="NP-REF-001",
                severity=Severity.ERROR,
                message=f"currency '{holding.currency}' is not in the pinned ISO 4217 allow-list",
                provenance=holding.field_provenance.get("currency", holding.provenance),
                holding_id=holding.holding_id,
            )
        )
    if holding.value_usd is None:
        violations.append(
            Violation(
                rule_id="NP-REF-001",
                severity=Severity.ERROR,
                message="USD value is no data because currency_value/exchange_rate could not be computed",
                provenance=holding.field_provenance.get("value_usd", holding.provenance),
                holding_id=holding.holding_id,
            )
        )
    elif not holding.value_usd.is_finite():
        violations.append(
            Violation(
                rule_id="NP-REF-001",
                severity=Severity.ERROR,
                message="USD value must be present and finite",
                provenance=holding.field_provenance.get("value_usd", holding.provenance),
                holding_id=holding.holding_id,
            )
        )
    return violations


def validate_fair_value_level(filing: Filing, holding: Holding | None) -> Iterable[Violation]:
    del filing
    assert holding is not None
    if not holding.fair_value_level:
        return [
            Violation(
                rule_id="NP-REF-002",
                severity=Severity.ERROR,
                message="fair_value_level is missing",
                provenance=holding.field_provenance.get("fair_value_level", holding.provenance),
                holding_id=holding.holding_id,
            )
        ]
    if holding.fair_value_level.strip().upper() in FAIR_VALUE_LEVELS:
        return []
    return [
        Violation(
            rule_id="NP-REF-002",
            severity=Severity.ERROR,
            message=f"fair value level '{holding.fair_value_level}' is not permitted",
            provenance=holding.field_provenance.get("fair_value_level", holding.provenance),
            holding_id=holding.holding_id,
        )
    ]
