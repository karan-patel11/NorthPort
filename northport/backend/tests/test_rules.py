from pathlib import Path

from northport.backend.ingest import load_filing
from northport.backend.ingest.dta_adapter import iter_dta_filings
from northport.backend.models import IdentifierSet
from northport.backend.validate import validate_filing
from northport.backend.validate.registry import LIVE_RULES, RULES

FIXTURES = Path(__file__).parent / "fixtures"
REAL_GCAP = Path("/Users/karanpatel/Downloads/gcap_slice/2025q4.dta")


def test_valid_fixture_passes_tier2_rules():
    filing = load_filing(FIXTURES / "sample_filing.csv")
    summary = validate_filing(filing)

    assert summary.errors == 0
    assert summary.passed


def test_bad_fixture_reports_traceable_rule_failures():
    filing = load_filing(FIXTURES / "bad_filing.csv")
    summary = validate_filing(filing)
    rule_ids = {violation.rule_id for violation in summary.violations}

    assert summary.errors >= 3
    assert {"NP-ID-001", "NP-REF-001", "NP-REF-002"} <= rule_ids
    assert all(item.provenance is not None for item in summary.violations if item.holding_id)


def test_liquidity_rule_is_cut_not_live():
    liquidity_rule = next(rule for rule in RULES if rule.rule_id == "NP-LIQ-001")

    assert liquidity_rule.status == "cut"
    assert liquidity_rule not in LIVE_RULES


def test_each_live_rule_passes_and_fires_against_real_gcap_row():
    if not REAL_GCAP.exists():
        return

    base = next(iter_dta_filings(REAL_GCAP, chunksize=1000))
    by_id = {rule.rule_id: rule for rule in LIVE_RULES}

    for rule_id, mutate in {
        "NP-ID-001": _remove_identifiers,
        "NP-ID-002": _break_identifier_format,
        "NP-REF-001": _break_currency,
        "NP-REF-002": _break_fair_value_level,
        "NP-DER-001": _break_derivative_category,
        "NP-NAV-001": _break_nav_reconciliation,
    }.items():
        rule = by_id[rule_id]
        assert validate_filing(base, rules=[rule]).violations == []

        failing = base.model_copy(deep=True)
        mutate(failing)
        violations = validate_filing(failing, rules=[rule]).violations
        assert {item.rule_id for item in violations} == {rule_id}


def _remove_identifiers(filing):
    filing.holdings[0].identifiers = IdentifierSet()


def _break_identifier_format(filing):
    filing.holdings[0].identifiers.cusip = "BAD"


def _break_currency(filing):
    filing.holdings[0].currency = "ZZZ"


def _break_fair_value_level(filing):
    filing.holdings[0].fair_value_level = "9"


def _break_derivative_category(filing):
    filing.holdings[0].payoff_profile = "Derivative option"
    filing.holdings[0].derivative_category = None


def _break_nav_reconciliation(filing):
    filing.holdings[0].percent_of_net_assets += 10
