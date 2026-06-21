from __future__ import annotations

from collections.abc import Iterable

from northport.backend.models import Filing, Holding
from northport.backend.validate.results import Severity, Violation

DERIVATIVE_CATEGORY_CODES = {"FUT", "OPT", "SWP", "FWD", "OTH", "OTHER"}
DERIVATIVE_PROFILE_MARKERS = {"derivative", "option", "future", "futures", "swap", "forward"}


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

    if derivative_category and profile in {"long", "short"}:
        violations.append(
            Violation(
                rule_id="NP-DER-001",
                severity=Severity.ERROR,
                message="derivative_cat is inconsistent with a plain long/short payoff_profile",
                provenance=holding.field_provenance.get("payoff_profile", holding.provenance),
                holding_id=holding.holding_id,
            )
        )
    return violations
