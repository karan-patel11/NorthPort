from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Literal

from northport.backend.models import Filing, Holding
from northport.backend.validate.results import Severity, Violation
from northport.backend.validate.tier2_rules import cross_field, identifiers, numeric, reference_data

RuleScope = Literal["holding", "filing"]
RuleStatus = Literal["live", "cut", "no_data"]


@dataclass(frozen=True)
class Rule:
    rule_id: str
    description: str
    severity: Severity
    spec_clause: str
    schema_elements: tuple[str, ...]
    scope: RuleScope
    evaluate: Callable[[Filing, Holding | None], Iterable[Violation]]
    status: RuleStatus = "live"


RULES: list[Rule] = [
    Rule(
        "NP-ID-001",
        "At least one recognized identifier is present for non-cash holdings.",
        Severity.ERROR,
        "Form N-PORT Part C holding identifiers. GCAP maps issuer_lei and issuer_cusip to issuer-level elements.",
        ("issuerLei", "issuerCusip", "identifierIsin", "identifierTicker", "otherIdentifier", "assetCat"),
        "holding",
        identifiers.require_identifier,
    ),
    Rule(
        "NP-ID-002",
        "LEI, CUSIP, and ISIN identifiers satisfy their published checksum/format rules.",
        Severity.ERROR,
        "Form N-PORT Part C identifier elements. GCAP issuer_lei/issuer_cusip are issuer-level.",
        ("issuerLei", "issuerCusip", "identifierIsin"),
        "holding",
        identifiers.validate_identifier_formats,
    ),
    Rule(
        "NP-REF-001",
        "Currency is a valid ISO 4217 code and USD value is computed from currency amount plus exchange rate.",
        Severity.ERROR,
        "Form N-PORT Part C value elements: currencyCode, currencyValue/exchangeRate, valUSD.",
        ("currencyCode", "currencyValue", "exchangeRate", "valUSD"),
        "holding",
        reference_data.validate_currency_and_value,
    ),
    Rule(
        "NP-REF-002",
        "Fair-value hierarchy level is one of the permitted levels.",
        Severity.ERROR,
        "Form N-PORT Part C fair value hierarchy element: fairValueLevel.",
        ("fairValueLevel",),
        "holding",
        reference_data.validate_fair_value_level,
    ),
    Rule(
        "NP-LIQ-001",
        "Cut: GCAP .dta slice has no liquidity classification field.",
        Severity.ERROR,
        "No verified GCAP column maps to the N-PORT liquidityClassification element. is_restricted_security is a different concept and is not used as a substitute.",
        ("liquidityClassification",),
        "holding",
        cross_field.require_liquidity_classification,
        "cut",
    ),
    Rule(
        "NP-DER-001",
        "Derivative category is consistent with payoff profile when derivative fields are available.",
        Severity.ERROR,
        "Form N-PORT derivative branch reduced to verified GCAP fields payoffProfile and derivativeCategory.",
        ("payoffProfile", "derivativeCategory"),
        "holding",
        cross_field.validate_derivative_detail,
    ),
    Rule(
        "NP-NAV-001",
        "Percent-of-net-assets values reconcile to total net assets within tolerance.",
        Severity.WARNING,
        "Form N-PORT Part C pctVal/currencyValue reconciled to fundInfo/netAssets.",
        ("pctVal", "valUSD", "netAssets"),
        "filing",
        numeric.reconcile_percent_of_net_assets,
    ),
]


LIVE_RULES: list[Rule] = [rule for rule in RULES if rule.status == "live"]
