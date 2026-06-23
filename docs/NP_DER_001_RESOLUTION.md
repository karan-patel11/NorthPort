# NP-DER-001 Resolution

Date: 2026-06-21

## Step 1 Evidence And Verdict

Adapter trace:

- `Holding.payoff_profile` reads the GCAP `payoff_profile` column in
  `northport/backend/ingest/dta_adapter.py:133`.
- `_map_holding()` assigns `payoff_profile` from `Holding.payoff_profile` in
  `northport/backend/ingest/dta_adapter.py:402`.
- The field map records the N-PORT target as `payoffProfile` in
  `docs/field_mapping.md:53`.

Stylesheet evidence:

- Item C.3 is wired to `m1:payoffProfile` in
  `backend/schemas/nport/N-PORT_schPortfolio.xsl:130-132`.
- Item C.3 instruction quote: "For derivatives, respond N/A to this Item"
  (`backend/schemas/nport/N-PORT_schPortfolio.xsl:130`).
- Item C.11 instruction quote: "For derivatives, also provide"
  (`backend/schemas/nport/N-PORT_schPortfolio.xsl:163`).
- Item C.11 derivative payoff quote: "Payoff profile, selected from among the following (long, short)."
  (`backend/schemas/nport/N-PORT_schPortfolio.xsl:1689`).
- Item C.11 option/warrant payoff quote: "written, purchased"
  (`backend/schemas/nport/N-PORT_schPortfolio.xsl:2507`).

XSD evidence:

| Item | XSD field | Allowed values | Structural location |
| --- | --- | --- | --- |
| C.3 | `payoffProfile` | `Long`, `Short`, `N/A` from `PAYOFF_PROFILE_TYPE` (`backend/schemas/nport/eis_NPORT_Filer.xsd:99-107`) | Child of each `invstOrSec` in `INVESTMENT_OR_SECURITY_LIST_TYPE`; XSD comment says "Item C.3" at `backend/schemas/nport/eis_NPORT_Filer.xsd:2293-2294`. It precedes `derivativeInfo` (`backend/schemas/nport/eis_NPORT_Filer.xsd:2307`). |
| C.11 futures/forwards | `payOffProf` | `Long`, `Short`, `N/A` from `PAYOFF_PROFILE_TYPE` (`backend/schemas/nport/eis_NPORT_Filer.xsd:99-107`) | Inside derivative-specific groups: `NONFX_FORWARD_BASE_GROUP`, `NONFX_FORWARD_HOLDING_GROUP`, `FUTURE_BASE_GROUP`, and `FUTURE_HOLDING_GROUP` at `backend/schemas/nport/eis_NPORT_Filer.xsd:1018`, `:1031`, `:1045`, and `:1058`. |
| C.11 option/swaption/warrant | `writtenOrPur` | `Written`, `Purchased` from `RESPOND_PURCHASED_TYPE` (`backend/schemas/nport/eis_NPORT_Filer.xsd:228-234`) | Inside `OPTION_WARRANT_SWAPTION_BASE_GROUP` and `OPTION_WARRANT_SWAPTION_HOLDING_GROUP` at `backend/schemas/nport/eis_NPORT_Filer.xsd:1075-1076` and `:1094-1095`. |

GCAP query evidence:

Concrete query: chunked `pyreadstat.read_dta()` over
`/Users/karanpatel/Downloads/gcap_slice/2025q4.dta` with `usecols=["payoff_profile", "derivative_cat", "accession_number"]`.

```text
rows 1300501
payoff_profile distribution
'Long' 1240530
'<missing>' 55382
'Short' 4589
profile marker hits 0
derivative_cat nonmissing and payoff_profile Long/Short 870
breakdown by derivative_cat
'FUT' 161
'FWD' 5
'OPT' 380
'SWP' 306
'WAR' 18
breakdown by payoff_profile
'Long' 402
'Short' 468
invalid derivative cats among long/short rows
```

Value-domain comparison: GCAP `payoff_profile` has only `Long`, `Short`, and
missing. That exactly matches the top-level C.3 `payoffProfile` domain after
allowing GCAP blanks as no-data; it does not match C.11 option/swaption/warrant
`writtenOrPur` (`Written`, `Purchased`). The same `PAYOFF_PROFILE_TYPE` is reused
for C.11 futures/forwards, so value domain alone is not sufficient, but the repo
mapping and XSD structural field name disambiguate the GCAP column to C.3.

Verdict: GCAP `payoff_profile` maps to Item C.3. The adapter reads the GCAP
column into `Holding.payoff_profile`, the field map targets `payoffProfile`, and
the XSD labels `payoffProfile` as Item C.3. C.11 payoff data lives under
`derivativeInfo` as `payOffProf` or `writtenOrPur`, which the GCAP adapter does
not populate.

## Step 2 Branch

Branch taken: reinstated the C.3 consistency check.

Why: the mapping is confirmed as C.3, and the stylesheet tells derivatives to
answer `N/A` to Item C.3 (`backend/schemas/nport/N-PORT_schPortfolio.xsl:130`).
The code now keeps three independent predicates in
`northport/backend/validate/tier2_rules/cross_field.py`:

- valid derivative category allow-list at `northport/backend/validate/tier2_rules/cross_field.py:27-36`
- required category when profile text indicates a derivative at `northport/backend/validate/tier2_rules/cross_field.py:38-47`
- C.3 consistency predicate at `northport/backend/validate/tier2_rules/cross_field.py:49-68`

The reinstated predicate fires only when `derivative_category` is one of the
XSD-valid categories and normalized C.3 `payoff_profile` is `long` or `short`.
Invalid categories remain handled by the enum predicate rather than being
reclassified as C.3 consistency defects.

## Full GCAP Slice Results

Before code change:

```text
filings 4024
holdings 1300501
passed 3687
failed 337
errors 10762
warnings 1079
per_rule
NP-ID-001 27
NP-ID-002 1772
NP-NAV-001 1079
NP-REF-001 8963
```

After code change:

```text
filings 4024
holdings 1300501
passed 3585
failed 439
errors 11632
warnings 1079
per_rule
NP-DER-001 870
NP-ID-001 27
NP-ID-002 1772
NP-NAV-001 1079
NP-REF-001 8963
```

Per-rule violation table:

| Rule | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `NP-DER-001` | 0 | 870 | +870 |
| `NP-ID-001` | 27 | 27 | 0 |
| `NP-ID-002` | 1,772 | 1,772 | 0 |
| `NP-NAV-001` | 1,079 | 1,079 | 0 |
| `NP-REF-001` | 8,963 | 8,963 | 0 |

Totals:

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Errors | 10,762 | 11,632 | +870 |
| Warnings | 1,079 | 1,079 | 0 |
| Filings passed | 3,687 | 3,585 | -102 |
| Filings failed | 337 | 439 | +102 |

## Tests

Command run:

```text
.venv/bin/python -m pytest
```

Result:

```text
20 passed, 2 skipped in 0.92s
```

Changed or added tests:

- `test_derivative_categories_match_pinned_xsd_values`
  (`northport/backend/tests/test_rules.py:64-80`) now asserts XSD-valid
  derivative categories pass when C.3 is `N/A`, and invalid `OTHER` still fails.
- `test_derivative_c3_payoff_profile_requires_na_for_valid_derivatives`
  (`northport/backend/tests/test_rules.py:83-102`) asserts a valid derivative
  category with C.3 `Long` or `Short` emits one `NP-DER-001` violation, while
  the same category with C.3 `N/A` passes.
