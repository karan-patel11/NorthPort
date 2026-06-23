from __future__ import annotations

from collections.abc import Iterable

from northport.backend.models import Filing, Holding
from northport.backend.validate.results import Severity, Violation

DERIVATIVE_CATEGORY_CODES = {"FWD", "FUT", "OPT", "OTH", "SWO", "SWP", "WAR"}
DERIVATIVE_PROFILE_MARKERS = {"derivative", "option", "future", "futures", "swap", "forward"}
DERIVATIVE_C3_PAYOFF_PROFILES = {"long", "short"}


def require_liquidity_classification(filing: Filing, holding: Holding | None) -> Iterable[Violation]:
    del filing
    assert holding is not None
    return []


def validate_derivative_detail(filing: Filing, holding: Holding | None) -> Iterable[Violation]:
    del filing
    assert holding is not None
    profile = (holding.payoff_profile or "").strip().lower()
    derivative_category = (holding.derivative_category or "").strip().upper()
    profile_indicates_derivative = any(marker in profile for marker in DERIVATIVE_PROFILE_MARKERS)

    violations: list[Violation] = []
    if derivative_category and derivative_category not in DERIVATIVE_CATEGORY_CODES:
        violations.append(
            Violation(
                rule_id="NP-DER-001",
                severity=Severity.ERROR,
                message=f"derivative category '{holding.derivative_category}' is not recognized",
                provenance=holding.field_provenance.get("derivative_category", holding.provenance),
                holding_id=holding.holding_id,
            )
        )

    if profile_indicates_derivative and not derivative_category:
        violations.append(
            Violation(
                rule_id="NP-DER-001",
                severity=Severity.ERROR,
                message="derivative_cat is required when payoff_profile indicates a derivative",
                provenance=holding.field_provenance.get("derivative_category", holding.provenance),
                holding_id=holding.holding_id,
            )
        )

    # N-PORT_schPortfolio.xsl:130 says derivatives should answer N/A to Item C.3.
    if _has_c3_derivative_payoff_conflict(derivative_category, profile):
        violations.append(
            Violation(
                rule_id="NP-DER-001",
                severity=Severity.ERROR,
                message="derivatives must answer N/A to Item C.3 payoff_profile",
                provenance=holding.field_provenance.get("payoff_profile", holding.provenance),
                holding_id=holding.holding_id,
            )
        )

    return violations


def _has_c3_derivative_payoff_conflict(derivative_category: str, profile: str) -> bool:
    return (
        derivative_category in DERIVATIVE_CATEGORY_CODES
        and profile in DERIVATIVE_C3_PAYOFF_PROFILES
    )
