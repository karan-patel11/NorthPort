from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal

from northport.backend.models import Filing, Holding
from northport.backend.validate.results import Severity, Violation

PERCENT_TOLERANCE = Decimal("0.50")


def reconcile_percent_of_net_assets(filing: Filing, holding: Holding | None) -> Iterable[Violation]:
    del holding
    if filing.header.net_assets == 0:
        return [
            Violation(
                rule_id="NP-NAV-001",
                severity=Severity.ERROR,
                message="net assets cannot be zero for percent reconciliation",
                provenance=None,
            )
        ]
    missing_value_holdings = [item for item in filing.holdings if item.value_usd is None]
    if missing_value_holdings:
        return [
            Violation(
                rule_id="NP-NAV-001",
                severity=Severity.WARNING,
                message=(
                    "percent-of-net-assets reconciliation is no data for "
                    f"{len(missing_value_holdings)} holding(s) with missing computed USD value"
                ),
                provenance=missing_value_holdings[0].field_provenance.get(
                    "value_usd",
                    missing_value_holdings[0].provenance,
                ),
            )
        ]
    implied = sum((item.value_usd / filing.header.net_assets) * Decimal("100") for item in filing.holdings)
    reported = sum(item.percent_of_net_assets for item in filing.holdings)
    drift = abs(implied - reported)
    if drift <= PERCENT_TOLERANCE:
        return []
    return [
        Violation(
            rule_id="NP-NAV-001",
            severity=Severity.WARNING,
            message=f"reported percent-of-net-assets drift is {drift:.4f} percentage points",
            provenance=None,
        )
    ]
