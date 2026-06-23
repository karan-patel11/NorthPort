# Pre-Push Verification

Date: 2026-06-21

Slice: `/Users/karanpatel/Downloads/gcap_slice/2025q4.dta`

Rows scanned: 1,300,501 holdings via `northport.backend.ingest.dta_adapter.iter_dta_rows`.

No Python/package code was changed for this verification. This document is the only requested output.

## Flagged Bugs Summary

- **BUG FOUND - NP-DER-001 is accidentally neutered.** The two remaining current predicates in `northport/backend/validate/tier2_rules/cross_field.py` have zero satisfying GCAP rows, but the removed long/short derivative payoff-profile predicate would still catch 870 rows. Those 870 are not invalid derivative-category enum cases; their categories are XSD-valid. They are, however, genuine payoff-profile instruction violations under the repo's current mapping because `payoff_profile` maps to Item C.3 and `backend/schemas/nport/N-PORT_schPortfolio.xsl:130` says derivatives should answer `N/A` to Item C.3. **Flagged, not fixed.**

## Check 1 - Is NP-DER-001 inert or accidentally neutered?

### Current rule predicates

Current source: `northport/backend/validate/tier2_rules/cross_field.py`.

The XSD-backed allow-list is defined at `cross_field.py:8`:

```python
DERIVATIVE_CATEGORY_CODES = {"FWD", "FUT", "OPT", "OTH", "SWO", "SWP", "WAR"}
```

The only current `NP-DER-001` emitting predicates are:

| Predicate | Source lines | Emitted message | GCAP satisfying rows |
|---|---:|---|---:|
| `derivative_category and derivative_category not in DERIVATIVE_CATEGORY_CODES` | `cross_field.py:26-35` | derivative category is not recognized | 0 |
| `profile_indicates_derivative and not derivative_category` | `cross_field.py:37-46` | derivative_cat is required when payoff_profile indicates a derivative | 0 |

GCAP derivative category distribution from the full slice:

| derivative_cat | Count |
|---|---:|
| `<missing>` | 1,244,670 |
| `FWD` | 20,619 |
| `FUT` | 5,695 |
| `OPT` | 7,239 |
| `OTH` | 257 |
| `SWO` | 744 |
| `SWP` | 20,580 |
| `WAR` | 697 |

Invalid derivative categories outside the current allow-list: **0**.

GCAP payoff profile distribution:

| payoff_profile | Count |
|---|---:|
| `Long` | 1,240,530 |
| `Short` | 4,589 |
| `<missing>` | 55,382 |

Rows whose `payoff_profile` contains any current marker in `{"derivative", "option", "future", "futures", "swap", "forward"}`: **0**. Therefore the second predicate is dead-by-construction on this slice.

### Accounting for the prior 870 long/short derivative cases

Concrete query: count rows with a non-missing `derivative_cat` and `payoff_profile` normalized to `long` or `short`.

Result: **870 rows**.

Breakdown by derivative category:

| derivative_cat | Count |
|---|---:|
| `FWD` | 5 |
| `FUT` | 161 |
| `OPT` | 380 |
| `SWP` | 306 |
| `WAR` | 18 |

Breakdown by payoff profile:

| payoff_profile | Count |
|---|---:|
| `Long` | 402 |
| `Short` | 468 |

These 870 were **not** genuine XSD enumeration violations. Their derivative categories are all allowed by the checked-in schema:

- OSW values `OPT`, `SWO`, and `WAR`: `backend/schemas/nport/eis_NPORT_Filer.xsd:47-49`
- Fixed derivative values `FWD`, `FUT`, `SWP`, and `OTH`: `backend/schemas/nport/eis_NPORT_Filer.xsd:896`, `:905`, `:917`, `:935`

But they **are genuine payoff-profile instruction violations** under the current repo mapping:

- `Holding.payoff_profile` is fed by the GCAP `payoff_profile` column in `northport/backend/ingest/dta_adapter.py:133` and mapped at `dta_adapter.py:402`.
- The stylesheet text at `backend/schemas/nport/N-PORT_schPortfolio.xsl:130` says Item C.3 is long/short/N/A and: "For derivatives, respond N/A to this Item and respond to the relevant payoff profile question in Item C.11."
- These 870 rows have a derivative category but answer Item C.3 as `Long` or `Short`, not `N/A`.

Plain answer: the 870 are **false positives only if NP-DER-001 is strictly an XSD enum check**. That is not how the current rule is described or wired; it is explicitly a payoff-profile consistency rule. Against the XSL instruction and current adapter mapping, they are genuine semantic violations.

### Conclusion

The current zero count is not a clean "all data is valid" result. Current `NP-DER-001` is inert on this dataset because its two remaining predicates have no satisfying rows, and it is accidentally neutered because the removed long/short derivative check was the only path catching the 870 genuine C.3/C.11 consistency defects.

**VERDICT: bug found - flagged, not fixed.**

## Check 2 - Did the NP-REF-002 N/A mapping silence real data?

### Source columns and mapping condition

Current source: `northport/backend/ingest/dta_adapter.py`.

Fair-value level is fed by exactly one DTA source column:

- `Holding.fair_value_level`: `("fair_value_level",)` at `dta_adapter.py:144-148`

The mapped holding field uses `_fair_value_level(row)` at `dta_adapter.py:409`.

The adapter emits `N/A` only here:

```python
def _fair_value_level(row: dict[str, Any]) -> str:
    return _optional_text(row, "Holding.fair_value_level") or "N/A"
```

Source lines: `dta_adapter.py:492-493`.

That means `N/A` is emitted only when `_optional_text` returns `None`. `_optional_text` calls `_pick` (`dta_adapter.py:488-489`); `_pick` returns a candidate only when `_clean(row[candidate]) is not None` (`dta_adapter.py:522-529`). `_clean` treats `None`, pandas NA, blank strings, and text sentinels such as `nan`, `nat`, `<na>`, and `none` as missing (`dta_adapter.py:547-560`).

XSD values are `1`, `2`, `3`, and `N/A` at `backend/schemas/nport/eis_NPORT_Filer.xsd:142-145`. The stylesheet says Item C.8 permits `N/A` when no level is associated at `backend/schemas/nport/N-PORT_schPortfolio.xsl:152`.

### Full-slice distribution

| raw fair_value_level after cleaning | Count |
|---|---:|
| `1` | 457,732 |
| `2` | 817,186 |
| `3` | 23,102 |
| `<missing>` | 2,481 |

### Evenly spaced sample of 20 missing fair-value rows

The sample below is evenly spaced across the 2,481 rows whose raw `fair_value_level` cleans to missing. "Raw repr" is the pre-mapping value read from the `.dta`.

| # | GCAP row | holding_id | raw `fair_value_level` repr | cleaned source | mapped | Classification |
|---:|---:|---|---|---|---|---|
| 1 | 217047 | 160327348 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 2 | 256821 | 160818916 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 3 | 257996 | 160851317 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 4 | 260156 | 161078240 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 5 | 407856 | 160727599 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 6 | 441706 | 160749227 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 7 | 475723 | 160785277 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 8 | 528043 | 160103574 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 9 | 528231 | 160107610 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 10 | 528365 | 160108581 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 11 | 638876 | 159836412 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 12 | 686980 | 159967423 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 13 | 687508 | 159968846 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 14 | 811989 | 160122162 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 15 | 901644 | 160699713 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 16 | 907490 | 160706682 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 17 | 990033 | 160969469 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 18 | 1068298 | 161100667 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 19 | 1075045 | 161099454 | `str:''` | `None` | `N/A` | source empty -> N/A correct |
| 20 | 1153289 | 159857847 | `str:''` | `None` | `N/A` | source empty -> N/A correct |

Sample proportion: **20/20 = 100% genuinely empty source values**. Data loss count in sample: **0/20**.

No sampled row contained a real source level value that the adapter discarded.

**VERDICT: clean.**

## Check 3 - FX reconciliation for NP-REF-001

### Code path under test

Current source: `northport/backend/ingest/dta_adapter.py`.

- `_map_holding` computes `value_usd` through `_compute_value_usd` at `dta_adapter.py:377-380`.
- `_compute_value_usd` reads `currency_value` at `dta_adapter.py:449`.
- For USD, it returns the amount unchanged at `dta_adapter.py:457-458`.
- For non-USD, missing `exchange_rate` returns `None` at `dta_adapter.py:460-461`.
- Zero `exchange_rate` returns `None` at `dta_adapter.py:462-464`.
- Otherwise, it returns `currency_value / exchange_rate` at `dta_adapter.py:465`.

Current `NP-REF-001` condition counts from the full slice:

| Condition | Violation count |
|---|---:|
| missing currency | 3,532 |
| invalid currency | 0 |
| missing computed `value_usd` | 5,431 |
| non-finite `value_usd` | 0 |
| **Total NP-REF-001 violations** | **8,963** |

Important: these are violation counts, not unique-row counts. Missing currency can also cause missing computed `value_usd`.

### Arithmetic sample

The following sample covers 5 non-USD holdings across 3 currencies. `Independent recompute` is a separate `Decimal(currency_value) / Decimal(exchange_rate)` calculation. `Exact match` compares that result to the adapter-computed `value_usd`.

| GCAP row | holding_id | issuer | ccy | raw `currency_value` | raw `exchange_rate` | computed `value_usd` | independent recompute | exact match | implied local units per USD |
|---:|---|---|---|---:|---:|---:|---:|---|---:|
| 757 | 160550698 | IBERDROLA SA | EUR | 317765637.77 | 0.86756604 | 366272563.8384831199709015812 | 366272563.8384831199709015812 | true | 0.8675660399999999999999999999 |
| 758 | 160550700 | COMMERZBANK AG | EUR | 233600807.38 | 0.86756604 | 269259971.7019813269777134199 | 269259971.7019813269777134199 | true | 0.8675660400000000000000000002 |
| 760 | 160550703 | ROLLSROYCE HOLDINGS PLC | GBP | 337920842.74 | 0.7612088 | 443926610.8589390979189941052 | 443926610.8589390979189941052 | true | 0.7612087999999999999999999999 |
| 767 | 160550715 | MITSUBISHI HEAVY INDUSTRIES LTD | JPY | 300129516.82 | 154.11 | 1947501.893582506002206216339 | 1947501.893582506002206216339 | true | 154.1100000000000000000000000 |
| 768 | 160550717 | RELX PLC | GBP | 282321717.69 | 0.7612088 | 370886040.3216568174198721822 | 370886040.3216568174198721822 | true | 0.7612088000000000000000000001 |

Arithmetic result: **5/5 exact matches** between the adapter and independent recomputation.

External FX-rate truth was not checked. The `implied local units per USD` column is provided for manual comparison against an external 2025-Q4 quarter-end rate source.

### Fail-closed exchange-rate path

Concrete query: count non-USD rows where raw `exchange_rate` is missing or decimal zero, then map each row through `_map_holding` and verify `value_usd is None`.

| Fail-closed condition | Row count |
|---|---:|
| non-USD with missing `exchange_rate` | 1,635 |
| non-USD with zero `exchange_rate` | 264 |
| **non-USD missing-or-zero `exchange_rate` total** | **1,899** |
| rows mapped to `value_usd = None` | 1,899 |
| rows mapped to fabricated non-null `value_usd` | 0 |

The fail-closed guarantee holds for the exchange-rate path: all 1,899 non-USD holdings with missing or zero exchange rates produced `value_usd = None`; none produced a fabricated numeric value.

**VERDICT: needs manual confirmation.**
