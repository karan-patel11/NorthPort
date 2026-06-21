from __future__ import annotations

from pydantic import BaseModel

from northport.backend.models import Filing
from northport.backend.validate.registry import LIVE_RULES, Rule
from northport.backend.validate.results import Severity, Violation


class ValidationSummary(BaseModel):
    total_rules: int
    total_holdings: int
    errors: int
    warnings: int
    violations: list[Violation]

    @property
    def passed(self) -> bool:
        return self.errors == 0


def validate_filing(filing: Filing, *, rules: list[Rule] | None = None) -> ValidationSummary:
    active_rules = rules or LIVE_RULES
    active_rules = [rule for rule in active_rules if rule.status == "live"]
    violations: list[Violation] = []

    holding_rules = [rule for rule in active_rules if rule.scope == "holding"]
    filing_rules = [rule for rule in active_rules if rule.scope == "filing"]

    for holding in filing.holdings:
        for rule in holding_rules:
            violations.extend(rule.evaluate(filing, holding))

    for rule in filing_rules:
        violations.extend(rule.evaluate(filing, None))

    return ValidationSummary(
        total_rules=len(active_rules),
        total_holdings=len(filing.holdings),
        errors=sum(1 for item in violations if item.severity == Severity.ERROR),
        warnings=sum(1 for item in violations if item.severity == Severity.WARNING),
        violations=violations,
    )
