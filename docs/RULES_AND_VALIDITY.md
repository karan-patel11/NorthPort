# NorthPort Rules And Validity Report

Audit date: 2026-06-21.

Scope: this report is grounded in the repository as checked out locally. I did not use SEC.gov or any other external source. Any regulatory or release-history claim not present in repo comments, constants, docstrings, schemas, fixtures, or checked-in documentation is marked `[UNVERIFIED]`.

## Executive Findings

NorthPort is not a pass-everything validator. A local run of the real GCAP slice referenced by the repo (`/Users/karanpatel/Downloads/gcap_slice/2025q4.dta`, also referenced in `northport/backend/tests/test_rules.py:10` and `docs/field_mapping.md:77`) produced 16,633 Tier-2 violations across 4,024 filings and 1,300,501 holdings. The largest fail-closed bucket is `NP-REF-001`: 5,431 distinct holdings had no computed USD value, generating 5,431 value no-data errors and, for 3,532 of those holdings, an additional missing-currency error.

The strongest part of the system is Tier-1 when an actual XSD entrypoint is configured. The weakest parts are several Tier-2 rules that are stricter, looser, or different from the checked-in schema:

- `NP-DER-001` rejects `SWO` and `WAR`, but the XSD lists those as derivative category values for option/swaption/warrant derivatives (`backend/schemas/nport/eis_NPORT_Filer.xsd:42-50`). This is a likely false-positive source.
- `NP-REF-002` rejects missing/`N/A` fair-value levels, but the XSD fair-value type allows `N/A` (`backend/schemas/nport/eis_NPORT_Filer.xsd:137-146`) and the stylesheet says Item C.8 permits `N/A` when no level is associated (`backend/schemas/nport/N-PORT_schPortfolio.xsl:152`).
- `NP-NAV-001` is presented in the registry as a warning (`northport/backend/validate/registry.py:83-90`) but can emit an error when net assets are zero (`northport/backend/validate/tier2_rules/numeric.py:14-22`). That is a real hard/soft mismatch in the rule metadata.

## Tier-1: XSD Schema Conformance

### Schema Version And Bundle

The checked-in EDGAR technical specification is titled `EDGAR Form N-PORT XML Technical Specification`, says `Version 1.13`, and is dated `March 2025` on its cover (`backend/schemas/nport/EDGAR Form N-PORT XML Technical Specification.pdf`, extracted text). The test suite also refers to the "pinned v1.13 union type" when normalizing redacted derivative delta values (`northport/backend/tests/test_real_fixtures.py:181-187`).

The XSD bundle under `backend/schemas/nport/` contains five `.xsd` files:

- `eis_Common.xsd`
- `eis_ISO_StateCodes.xsd`
- `eis_NPORT_Filer.xsd`
- `eis_NPORT_common.xsd`
- `eis_stateCodes.xsd`

Using the bundled Python 3.12 runtime with `lxml`, all five compile as standalone XMLSchema documents. The operative N-PORT entrypoint is `eis_NPORT_Filer.xsd`: sample XML files point `xsi:schemaLocation` to `eis_NPORT_Filer.xsd` (`backend/schemas/nport/N-PORT Sample 6.xml:3`), and that schema imports `eis_Common.xsd`, `eis_NPORT_common.xsd`, and `eis_ISO_StateCodes.xsd` (`backend/schemas/nport/eis_NPORT_Filer.xsd:6-8`).

Important configuration caveat: the code default is not the checked-in bundle. `DEFAULT_SCHEMA_PATH` points to `northport/backend/schemas/sec_nport.xsd` (`northport/backend/validate/tier1_xsd.py:7`), and `resolve_schema_path()` uses it when no environment variable is set (`northport/backend/validate/tier1_xsd.py:31-43`). That file is absent in this checkout. Passing the directory `backend/schemas/nport/` without `NORTHPORT_XSD_ENTRYPOINT` is also ambiguous because the resolver raises when multiple `.xsd` files are present (`northport/backend/validate/tier1_xsd.py:113-137`). Therefore Tier-1 is real only when `NORTHPORT_XSD_PATH=backend/schemas/nport/eis_NPORT_Filer.xsd` or equivalent entrypoint configuration is supplied.

### What Conformance Means

Tier-1 uses `lxml.etree.XMLSchema` with network access disabled. Compilation parses the configured schema entrypoint and constructs an XMLSchema object (`northport/backend/validate/tier1_xsd.py:68-71`); missing entrypoints and schema parse failures raise `SchemaUnavailableError` (`northport/backend/validate/tier1_xsd.py:60-75`). Validation parses the XML, calls `schema.validate(document)`, and raises `SchemaValidationError` with the schema error log if validation fails (`northport/backend/validate/tier1_xsd.py:82-93`).

Concretely, XSD conformance enforces:

- Required top-level structure: `edgarSubmission` contains optional `schemaVersion`, required `headerData`, required `formData`, and optional `documents` (`backend/schemas/nport/eis_NPORT_Filer.xsd:2433-2444`).
- Header presence and cardinality: `submissionType`, `isConfidential`, and `filerInfo` are required exactly once (`backend/schemas/nport/eis_NPORT_Filer.xsd:525-535`); issuer credentials require `cik` and `ccc` (`backend/schemas/nport/eis_NPORT_Filer.xsd:608-615`).
- Form sections: `formData` requires `genInfo`, `fundInfo`, and `signature`; `invstOrSecs` and explanatory notes are optional (`backend/schemas/nport/eis_NPORT_Filer.xsd:618-628`).
- Part A general information: registrant name, file number, CIK, LEI, address, series information, reporting dates, and final-filing flag with explicit `minOccurs`/`maxOccurs` (`backend/schemas/nport/eis_NPORT_Filer.xsd:1582-1608`).
- Part B fund information: assets/liabilities, return information, flows, optional liquidity/risk/derivatives/VaR/names-rule sections (`backend/schemas/nport/eis_NPORT_Filer.xsd:1532-1579`).
- Part C/D holdings: each `invstOrSec` is required when `invstOrSecs` is present, with maximum 500,000 holdings; each holding requires identification, amount, payoff profile, asset/issuer group, investment country, restricted-security flag, fair-value level, and security-lending group (`backend/schemas/nport/eis_NPORT_Filer.xsd:2281-2308`).
- Type constraints: examples include CCC length 8 (`backend/schemas/nport/eis_Common.xsd:70-76`), CIK pattern (`backend/schemas/nport/eis_Common.xsd:41-47`), LEI/RSSD/`N/A` pattern (`backend/schemas/nport/eis_NPORT_common.xsd:323-329`), LEI format documentation (`backend/schemas/nport/eis_NPORT_common.xsd:332-345`), CUSIP pattern (`backend/schemas/nport/eis_NPORT_common.xsd:360-365`), ISIN pattern and Luhn documentation (`backend/schemas/nport/eis_NPORT_common.xsd:380-395`), decimal total digits/non-negative constraints (`backend/schemas/nport/eis_NPORT_common.xsd:24-67`), and `N/A` unions (`backend/schemas/nport/eis_NPORT_common.xsd:99-100`, `backend/schemas/nport/eis_NPORT_common.xsd:317-320`).
- Enumerations and choices: submission types (`backend/schemas/nport/eis_NPORT_Filer.xsd:14-24`), liquidity categories (`backend/schemas/nport/eis_NPORT_Filer.xsd:53-85`), payoff profile (`backend/schemas/nport/eis_NPORT_Filer.xsd:99-108`), asset categories (`backend/schemas/nport/eis_NPORT_Filer.xsd:110-135`), fair-value levels including `N/A` (`backend/schemas/nport/eis_NPORT_Filer.xsd:137-146`), derivative categories (`backend/schemas/nport/eis_NPORT_Filer.xsd:42-50`, `backend/schemas/nport/eis_NPORT_Filer.xsd:879-941`), and USD vs non-USD currency representation (`backend/schemas/nport/eis_NPORT_Filer.xsd:1776-1806`).
- Uniqueness constraints: examples include unique derivative transaction classification (`backend/schemas/nport/eis_NPORT_Filer.xsd:648-651`), unique asset category in return information (`backend/schemas/nport/eis_NPORT_Filer.xsd:2204-2207`), and unique liquidity category (`backend/schemas/nport/eis_NPORT_Filer.xsd:2321-2325`).

Tier-1 does not map raw XML into NorthPort's internal model. `parse_xml()` validates the raw XML and then raises `ParseError` because raw SEC N-PORT XML field mapping is gated on the schema and field mapping documentation (`northport/backend/ingest/loaders.py:117-125`).

### Major Schema Sections And Regulatory Grounding

| Schema section | What the XSD enforces | Repo-grounded regulatory basis |
| --- | --- | --- |
| Header / filer credentials | Submission type, confidentiality flag, filer info, CIK/CCC, optional contact/series/flags (`backend/schemas/nport/eis_NPORT_Filer.xsd:525-615`). | EDGAR/N-PORT header semantics are present in schema comments. Specific SEC rule or release introducing these fields is `[UNVERIFIED]`. |
| Part A general information | Registrant identity, file number, CIK, LEI, address, series, reporting period, final-filing flag (`backend/schemas/nport/eis_NPORT_Filer.xsd:1582-1608`). | Schema labels this Part A / Form N-PORT. Specific SEC rule or release is `[UNVERIFIED]`. |
| Part B fund information | Assets/liabilities, returns, flows, securities lending, optional liquidity/minimum, derivative transaction, derivative exposure, VaR, names-rule policy (`backend/schemas/nport/eis_NPORT_Filer.xsd:1532-1579`). | Form N-PORT Part B in schema comments. Specific release history is `[UNVERIFIED]`. |
| B.7 Highly Liquid Investment Minimum | Optional `liquidInvst`, required `highlyLiquidInvst`, `daysOfHolding`, and report-period change branch (`backend/schemas/nport/eis_NPORT_Filer.xsd:1826-1836`, `backend/schemas/nport/eis_NPORT_Filer.xsd:1887-1914`). | No SEC rule citation in repo. Any link to liquidity rulemaking is `[UNVERIFIED]`. |
| B.9 derivatives exposure | Optional `derivExposureInfo` with exposure percentages and business-day excess count (`backend/schemas/nport/eis_NPORT_Filer.xsd:656-670`). | XSD explicitly cites rule 18f-4 and 17 CFR 270.18f-4 (`backend/schemas/nport/eis_NPORT_Filer.xsd:658-670`). The release that introduced it is `[UNVERIFIED]`. |
| B.10 VaR information | Optional `varInfo` with required `medianDailyVarPct`, optional relative VaR details, and required `backtestingResults` (`backend/schemas/nport/eis_NPORT_Filer.xsd:677-689`, `backend/schemas/nport/eis_NPORT_Filer.xsd:2447-2455`). | XSD explicitly cites rule 18f-4(c)(2), 18f-4(c)(2)(ii), and 18f-4(c)(1)(iv) (`backend/schemas/nport/eis_NPORT_Filer.xsd:679-689`). The release that introduced it is `[UNVERIFIED]`. |
| B.11 names-rule policy | Optional `namesRuleInvstPolicy`, terms, and 80% basket value (`backend/schemas/nport/eis_NPORT_Filer.xsd:1843-1857`). | XSD explicitly cites rule 35d-1(a)(2)(i) and (a)(3)(i) (`backend/schemas/nport/eis_NPORT_Filer.xsd:1843-1846`). The release that introduced it is `[UNVERIFIED]`. |
| Part C/D investments | Holding identification, amount, payoff profile, asset/issuer, country, restricted flag, liquidity classification, fair value, debt/repurchase/derivative/security lending (`backend/schemas/nport/eis_NPORT_Filer.xsd:2281-2308`). | Schema labels Part C/D and Item C sections. Specific SEC rule or release for most fields is `[UNVERIFIED]`. |
| Item C.7 liquidity classification | Optional `fundCat=N/A` or `fundCats` with 1-4 category allocations and 0-3 circumstances (`backend/schemas/nport/eis_NPORT_Filer.xsd:2315-2343`). | No SEC rule citation in repo. Any claim about the rule that introduced it is `[UNVERIFIED]`. |
| Item C.11 derivatives as holdings/reference instruments | Category-specific derivative structures for forwards, futures, swaps, option/swaption/warrant, and other derivatives (`backend/schemas/nport/eis_NPORT_Filer.xsd:879-941`, `backend/schemas/nport/eis_NPORT_Filer.xsd:943-1011`). | Schema labels Item C.11. No rule/release citation in those comments; broader derivatives exposure/VaR sections cite rule 18f-4. Introduction of C.11 details is `[UNVERIFIED]`. |

### Version Mismatch: What Actually Fails

The repository does not implement a hard failure on the `schemaVersion` value itself. In the XSD, `schemaVersion` is optional (`backend/schemas/nport/eis_NPORT_Filer.xsd:2439`) and its type is only a five-character token (`backend/schemas/nport/eis_Common.xsd:6-12`). The schema comment says EDGAR generates a warning if a supplied value does not match the current schemafile (`backend/schemas/nport/eis_Common.xsd:6-9`), not that local XSD validation fails. `backend/schemas/nport/N-PORT Sample 6.xml` contains `<schemaVersion>X0101</schemaVersion>` (`backend/schemas/nport/N-PORT Sample 6.xml:4`) and validates against the checked-in entrypoint in a local compile run.

What does fail is structural or type mismatch against the configured schema. The failure point is `if not schema.validate(document): ... raise SchemaValidationError(errors)` (`northport/backend/validate/tier1_xsd.py:91-93`). Concrete fixture failures:

- `N-PORT Sample 1.xml` has `<ccc>filerccc#1</ccc>` (`backend/schemas/nport/N-PORT Sample 1.xml:17`), but `CCC_TYPE` requires length 8 (`backend/schemas/nport/eis_Common.xsd:70-76`).
- `infinity_2021q4.xml` has `<documents>XXXX</documents>` (`backend/tests/fixtures/edgar/infinity_2021q4.xml:75`); the negative test expects a schema error mentioning `documents` (`northport/backend/tests/test_real_fixtures.py:123-135`).
- `pimco_2024.xml` has an empty `<varInfo>` (`backend/tests/fixtures/edgar_real/pimco_2024.xml:204-207`), while `varInfo` requires `medianDailyVarPct` and `backtestingResults` (`backend/schemas/nport/eis_NPORT_Filer.xsd:684-689`).
- `pimco_2024.xml` has redacted `<delta>XXXX</delta>` (`backend/tests/fixtures/edgar_real/pimco_2024.xml:1017`); the test normalizes those redactions to `N/A` because the pinned v1.13 union type accepts `N/A` (`northport/backend/tests/test_real_fixtures.py:181-187`, `backend/schemas/nport/eis_NPORT_common.xsd:99-100`, `backend/schemas/nport/eis_NPORT_common.xsd:317-320`).

So, a 2024 filing against an older schema fails only if the document uses elements, order, cardinality, or types that the selected schema does not accept. A `schemaVersion` mismatch alone is not a local hard failure in this repo.

## Tier-2: Active Business Rules

Tier-2 rules are declared in `RULES` (`northport/backend/validate/registry.py:27-92`), and `LIVE_RULES` filters only `status == "live"` (`northport/backend/validate/registry.py:95`). The engine also filters out non-live rules before execution (`northport/backend/validate/engine.py:22-35`).

Hard vs soft is enforced by emitted `Violation.severity` (`northport/backend/validate/results.py:10-20`). A filing passes only when `summary.errors == 0` (`northport/backend/validate/engine.py:17-19`), and XML generation is blocked unless `summary.passed` is true (`northport/backend/api/app.py:226-231`). Warnings are counted and reported but do not block `passed`.

General ingestion fail-closed behavior before rules run:

- CSV requires required headers and at least one row (`northport/backend/ingest/loaders.py:64-79`).
- JSON requires object/header/holdings structure and required holding fields (`northport/backend/ingest/loaders.py:82-115`).
- Required blank values raise `ParseError` (`northport/backend/ingest/loaders.py:216-222`).
- Malformed decimals raise `ParseError` (`northport/backend/ingest/loaders.py:233-250`).
- DTA columns must match the verified column contract exactly (`northport/backend/ingest/dta_adapter.py:22-64`, `northport/backend/ingest/dta_adapter.py:555-568`).
- DTA missing `currency_value`, missing currency, missing non-USD exchange rate, and zero exchange rate are converted to `value_usd=None` rather than fabricated (`northport/backend/ingest/dta_adapter.py:438-461`); `NP-REF-001` and `NP-NAV-001` then flag that no-data state.

### Rule Table

| Rule | Intent | Exact trigger predicate(s) | Hard vs soft | Fail-closed behavior | Grounding and weakness |
| --- | --- | --- | --- | --- | --- |
| `NP-ID-001` | Non-cash holdings must have at least one recognized identifier. | It skips cash/currency: `if holding.security_category.lower() in {"cash", "currency"}: return []` (`northport/backend/validate/tier2_rules/identifiers.py:17-18`). It passes if any identifier exists: `if any([identifiers.lei, identifiers.cusip, identifiers.isin, identifiers.ticker, identifiers.other]): return []` (`northport/backend/validate/tier2_rules/identifiers.py:19-21`). Otherwise it emits `"holding must include at least one identifier"` (`northport/backend/validate/tier2_rules/identifiers.py:22-29`). | Hard error. The rule registry marks `Severity.ERROR` (`northport/backend/validate/registry.py:28-36`), and the violation factory emits `Severity.ERROR` (`northport/backend/validate/tier2_rules/identifiers.py:100-107`). | Missing optional identifiers become `None` through `IdentifierSet.blank_to_none` (`northport/backend/models/filing.py:24-31`) and can trigger the rule. Missing required holding/model fields fail ingestion before this rule (`northport/backend/models/filing.py:110-125`). | XSD requires issuer identification and an identifier group for each holding (`backend/schemas/nport/eis_NPORT_Filer.xsd:1808-1823`). The cash/currency exemption is a `[DESIGN CHOICE - no external citation in repo]` and could be a false negative if N-PORT still expects identifiers for those rows. |
| `NP-ID-002` | LEI, CUSIP, and ISIN values must satisfy format/check rules. | `if ids.lei and not _valid_lei(ids.lei)` (`northport/backend/validate/tier2_rules/identifiers.py:37-40`); `if ids.cusip and not _valid_cusip(ids.cusip)` (`northport/backend/validate/tier2_rules/identifiers.py:41-44`); `if ids.isin and not _valid_isin(ids.isin)` (`northport/backend/validate/tier2_rules/identifiers.py:45-48`). Regex/checksum code is at `northport/backend/validate/tier2_rules/identifiers.py:9-11` and `northport/backend/validate/tier2_rules/identifiers.py:52-93`. | Hard error. Registry is `Severity.ERROR` (`northport/backend/validate/registry.py:37-45`); violations use `Severity.ERROR` (`northport/backend/validate/tier2_rules/identifiers.py:100-107`). | Blank identifiers become `None` and are skipped. Nonblank malformed identifiers emit errors. A literal `N/A` or 10-digit RSSD in LEI would fail this rule, although the XSD allows those in `LEI_TYPE_RSS_NA` (`backend/schemas/nport/eis_NPORT_common.xsd:323-329`). | LEI and ISIN are partly grounded in schema documentation: LEI references ISO 17442 (`backend/schemas/nport/eis_NPORT_common.xsd:332-340`), and ISIN documentation references Luhn (`backend/schemas/nport/eis_NPORT_common.xsd:380-388`). CUSIP check digit validation is a `[DESIGN CHOICE - no external citation in repo]`; the XSD has a CUSIP pattern but no check-digit comment (`backend/schemas/nport/eis_NPORT_common.xsd:360-365`). |
| `NP-REF-001` | Currency must be recognized and computed USD value must be present/finite. | `if not holding.currency` (`northport/backend/validate/tier2_rules/reference_data.py:171-180`); `elif holding.currency not in ISO_4217_CODES` (`northport/backend/validate/tier2_rules/reference_data.py:181-190`); `if holding.value_usd is None` (`northport/backend/validate/tier2_rules/reference_data.py:191-200`); `elif not holding.value_usd.is_finite()` (`northport/backend/validate/tier2_rules/reference_data.py:201-210`). | Hard error. Registry is `Severity.ERROR` (`northport/backend/validate/registry.py:46-54`), and emitted violations are `Severity.ERROR` (`northport/backend/validate/tier2_rules/reference_data.py:173-210`). | Missing currency is an error. Missing/zero non-USD rate or missing `currency_value` causes `value_usd=None` in the DTA adapter (`northport/backend/ingest/dta_adapter.py:445-461`) and then an error. Malformed decimals fail ingestion before this rule (`northport/backend/ingest/dta_adapter.py:507-511`). | Currency element and non-USD exchange-rate branch are grounded in the XSD (`backend/schemas/nport/eis_NPORT_Filer.xsd:1776-1806`). The exact code allow-list is internal (`northport/backend/validate/tier2_rules/reference_data.py:7-162`) and can diverge from the XSD currency enumerations (`backend/schemas/nport/eis_NPORT_common.xsd:124-315`). The USD derivation is empirical: docs state `value_usd = currency_value / exchange_rate` based on GCAP examples (`docs/field_mapping.md:65-89`) and the adapter implements it (`northport/backend/ingest/dta_adapter.py:438-461`). `[DESIGN CHOICE - no external citation in repo]` for using this derivation as a validation rule. |
| `NP-REF-002` | Fair-value hierarchy level must be permitted. | `if not holding.fair_value_level` emits missing (`northport/backend/validate/tier2_rules/reference_data.py:217-226`). `if holding.fair_value_level.upper() in FAIR_VALUE_LEVELS: return []` (`northport/backend/validate/tier2_rules/reference_data.py:227-228`); otherwise emit `"fair value level ... is not permitted"` (`northport/backend/validate/tier2_rules/reference_data.py:229-237`). `FAIR_VALUE_LEVELS = {"1", "2", "3", "LEVEL_1", "LEVEL_2", "LEVEL_3"}` (`northport/backend/validate/tier2_rules/reference_data.py:164`). | Hard error. Registry is `Severity.ERROR` (`northport/backend/validate/registry.py:55-63`); emitted violations are errors (`northport/backend/validate/tier2_rules/reference_data.py:219-236`). | Missing optional `fair_value_level` becomes `None` (`northport/backend/models/filing.py:132-149`) and fails closed as an error. | Partly grounded: XSD fair-value type allows `1`, `2`, `3`, and `N/A` (`backend/schemas/nport/eis_NPORT_Filer.xsd:137-146`), and stylesheet says Item C.8 permits `N/A` when no level is associated (`backend/schemas/nport/N-PORT_schPortfolio.xsl:152`). The rule's rejection of missing/`N/A` is likely too strict; acceptance of `LEVEL_*` is a `[DESIGN CHOICE - no external citation in repo]` and could be a false negative relative to XSD. |
| `NP-DER-001` | Derivative category should be recognized and consistent with payoff profile. | `if derivative_category and derivative_category not in DERIVATIVE_CATEGORY_CODES` (`northport/backend/validate/tier2_rules/cross_field.py:26-35`); `if profile_indicates_derivative and not derivative_category` (`northport/backend/validate/tier2_rules/cross_field.py:37-46`); `if derivative_category and profile in {"long", "short"}` (`northport/backend/validate/tier2_rules/cross_field.py:48-57`). Code allow-list is `{"FUT", "OPT", "SWP", "FWD", "OTH", "OTHER"}` and marker list is `{"derivative", "option", "future", "futures", "swap", "forward"}` (`northport/backend/validate/tier2_rules/cross_field.py:8-9`). | Hard error. Registry is `Severity.ERROR` (`northport/backend/validate/registry.py:74-82`), and emitted violations are `Severity.ERROR` (`northport/backend/validate/tier2_rules/cross_field.py:28-56`). | Missing `derivative_category` is only an error if payoff profile contains one of the marker words. In the full 2025Q4 GCAP run, no payoff profiles contained those marker words, so that missing-category branch was operationally silent on real data. | Weak. The rewrite to verified fields is documented (`docs/field_mapping.md:102-104`), and absent derivative type/notional/counterparty fields are documented (`docs/field_mapping.md:106-117`). But the XSD allows `SWO` and `WAR` for option/swaption/warrant derivatives (`backend/schemas/nport/eis_NPORT_Filer.xsd:42-50`, `backend/schemas/nport/eis_NPORT_Filer.xsd:920-927`), while the code rejects them. Conversely, code accepts `OTHER`, while XSD uses fixed `OTH` for other derivatives (`backend/schemas/nport/eis_NPORT_Filer.xsd:929-936`). The long/short inconsistency check has support from the stylesheet instruction that derivatives should answer `N/A` to Item C.3 (`backend/schemas/nport/N-PORT_schPortfolio.xsl:130`), but using GCAP `payoff_profile` as that exact field is an empirical assumption. |
| `NP-NAV-001` | Sum of holding percentages should reconcile with computed values and net assets. | `if filing.header.net_assets == 0` emits error (`northport/backend/validate/tier2_rules/numeric.py:14-22`). `missing_value_holdings = [item for item in filing.holdings if item.value_usd is None]` and `if missing_value_holdings` emits warning/no-data (`northport/backend/validate/tier2_rules/numeric.py:23-38`). Otherwise it computes `implied = sum((item.value_usd / filing.header.net_assets) * Decimal("100") for item in filing.holdings)`, `reported = sum(item.percent_of_net_assets for item in filing.holdings)`, and `if drift <= PERCENT_TOLERANCE: return []`; else emits drift warning (`northport/backend/validate/tier2_rules/numeric.py:39-51`). Tolerance is `Decimal("0.50")` (`northport/backend/validate/tier2_rules/numeric.py:9`). | Mostly soft warning, but not always. Registry says `Severity.WARNING` (`northport/backend/validate/registry.py:83-91`); missing values and drift emit warnings (`northport/backend/validate/tier2_rules/numeric.py:23-51`); zero net assets emit `Severity.ERROR` and block pass (`northport/backend/validate/tier2_rules/numeric.py:14-22`, `northport/backend/validate/engine.py:17-19`). | Missing computed USD value causes a filing-level no-data warning and skips drift calculation. Zero net assets hard-fails. | The elements `pctVal`, `valUSD`, and `netAssets` are schema fields (`backend/schemas/nport/eis_NPORT_Filer.xsd:1537-1540`, `backend/schemas/nport/eis_NPORT_Filer.xsd:1776-1787`). The 0.50 percentage-point tolerance, summing method, and assumption that GCAP `percentage` should reconcile this way are `[DESIGN CHOICE - no external citation in repo]`. |

## Cut Or Rewritten Rules

`NP-LIQ-001` is cut. The registry marks it `status="cut"` and says there is no verified GCAP column mapping to `liquidityClassification`; `is_restricted_security` is explicitly not used as a substitute (`northport/backend/validate/registry.py:64-73`). The implementation returns no violations (`northport/backend/validate/tier2_rules/cross_field.py:12-15`), and `LIVE_RULES` excludes non-live rules (`northport/backend/validate/registry.py:95`). The field mapping repeats that the `.dta` has no `liquidity_classification` or `liquidity_cat` and that restricted security is not liquidity (`docs/field_mapping.md:102`, `docs/field_mapping.md:106-117`). Coverage consequence: NorthPort does not validate Item C.7 liquidity classification at Tier-2, even though the XSD has C.7 liquidity structures (`backend/schemas/nport/eis_NPORT_Filer.xsd:2315-2343`).

`NP-DER-001` was rewritten to use only `payoff_profile` and `derivative_cat` (`docs/field_mapping.md:103-104`). The verified GCAP slice lacks `derivative_type`, `notional_usd`, `notional_amount`, and `counterparty` (`docs/field_mapping.md:106-117`), so NorthPort does not validate notional amounts, counterparties, expiration, settlement, delta, unrealized appreciation, payment legs, or other detailed Item C.11 derivative fields. Coverage consequence: the rule is only a shallow consistency check, and its current category allow-list is inconsistent with the XSD for `SWO` and `WAR`.

## Legitimacy Assessment

Defensible to a regtech engineer or SEC filing analyst:

- Tier-1 XSD validation, provided the real entrypoint is configured. It uses `lxml.etree.XMLSchema`, local imports, no network, and fails closed on unavailable/malformed schema (`northport/backend/validate/tier1_xsd.py:46-75`, `northport/backend/validate/tier1_xsd.py:82-93`).
- `NP-REF-001` as a fail-closed no-data check for missing currency/computed USD value. The schema has currency/value fields (`backend/schemas/nport/eis_NPORT_Filer.xsd:1776-1806`), and the adapter refuses to fabricate when inputs are missing or zero (`northport/backend/ingest/dta_adapter.py:438-461`).
- `NP-ID-002` as an identifier hygiene rule, with caveats. LEI and ISIN have repo-grounded standard references (`backend/schemas/nport/eis_NPORT_common.xsd:332-340`, `backend/schemas/nport/eis_NPORT_common.xsd:380-388`).
- `NP-NAV-001` as a soft analytic warning, not as a regulatory rejection rule. It is useful only if the `percentage` and `net_assets` semantics are correct.

Rules a domain expert would challenge:

- `NP-DER-001`, because it rejects XSD-recognized `SWO` and `WAR`, accepts non-XSD `OTHER`, and its missing-category branch relies on marker words that did not occur in the real GCAP payoff profile field.
- `NP-REF-002`, because it rejects `N/A` despite the XSD and stylesheet allowing it for fair value.
- `NP-REF-001` currency membership, because the code's ISO allow-list is independent of and different from the XSD currency enumeration.
- `NP-ID-001`, because it reduces a richer XSD identification structure to "any identifier" and adds a cash/currency exemption without repo-grounded external authority.
- `NP-NAV-001` as a blocker if `net_assets == 0`, because the registry presents the rule as a warning but the function can emit an error.

Empirical assumptions and risks:

- `value_usd = currency_value / exchange_rate` for non-USD and identity for USD (`docs/field_mapping.md:65-89`, `northport/backend/ingest/dta_adapter.py:438-461`). Risk: if GCAP exchange-rate semantics change or differ by row, `NP-REF-001` and `NP-NAV-001` produce false results.
- `percentage` maps directly to `pctVal`; NorthPort does not derive it (`docs/field_mapping.md:91-92`). Risk: if GCAP percentage uses a different denominator or class/series scope, `NP-NAV-001` false positives are likely.
- `total_liabilities = total_assets - net_assets` (`northport/backend/ingest/dta_adapter.py:351-370`, `docs/field_mapping.md:35`). Risk: derived balance-sheet fields may hide source errors.
- `report_date` is used as report period end, while docs note GCAP also contains `report_ending_period` (`northport/backend/ingest/dta_adapter.py:88-92`, `docs/field_mapping.md:33`). Risk: wrong period anchoring.
- `security_type` from `issuer_title`/`asset_cat` and `issuer_category` from `issuer_type` are medium-confidence mappings (`northport/backend/ingest/dta_adapter.py:117-121`, `northport/backend/ingest/dta_adapter.py:136-140`, `docs/field_mapping.md:45-56`). Risk: downstream rules may validate mapped approximations, not true N-PORT semantics.
- `issuer_lei` and `issuer_cusip` are treated as issuer-level N-PORT fields (`northport/backend/ingest/dta_adapter.py:103-112`, `docs/field_mapping.md:98-99`). Risk: source column meaning must remain stable.
- `NP-NAV-001` tolerance of 0.50 percentage points is not externally grounded (`northport/backend/validate/tier2_rules/numeric.py:9`).
- `NP-DER-001` marker words and category list are local code choices (`northport/backend/validate/tier2_rules/cross_field.py:8-9`).
- Fair-value `LEVEL_*` normalization is local and not in the XSD (`northport/backend/validate/tier2_rules/reference_data.py:164`, `backend/schemas/nport/eis_NPORT_Filer.xsd:137-146`).
- The DTA reader requires an exact 41-column contract (`northport/backend/ingest/dta_adapter.py:22-64`, `northport/backend/ingest/dta_adapter.py:555-568`). Risk: future legitimate GCAP schema changes fail ingestion before validation.

Specific false-positive / false-negative risks:

- False positive: `NP-DER-001` flags `SWO` and `WAR`; the XSD recognizes them (`backend/schemas/nport/eis_NPORT_Filer.xsd:42-50`).
- False negative: `NP-DER-001` accepts `OTHER`; the XSD fixed value for other derivatives is `OTH` (`backend/schemas/nport/eis_NPORT_Filer.xsd:929-936`).
- False negative: missing derivative category is not flagged when `payoff_profile` is `N/A`, `Long`, or `Short`; the real 2025Q4 run had zero marker-word payoff profiles.
- False positive: `NP-REF-002` flags missing/`N/A` fair-value level even though schema/style text permits `N/A` (`backend/schemas/nport/eis_NPORT_Filer.xsd:137-146`, `backend/schemas/nport/N-PORT_schPortfolio.xsl:152`).
- False negative: `NP-REF-002` accepts `LEVEL_1`, `LEVEL_2`, `LEVEL_3`, which are not XSD enumerations (`northport/backend/validate/tier2_rules/reference_data.py:164`).
- False positive or negative: `NP-REF-001` code currency list can diverge from XSD currency enumerations (`northport/backend/validate/tier2_rules/reference_data.py:7-162`, `backend/schemas/nport/eis_NPORT_common.xsd:124-315`).
- False positive: `NP-ID-002` can reject LEI values such as `N/A` or 10-digit RSSD that the XSD allows (`backend/schemas/nport/eis_NPORT_common.xsd:323-329`).
- False negative: `NP-ID-001` passes a holding if any identifier is present, even if issuer-level LEI/CUSIP fields are absent; the XSD separately requires `lei`, `cusip`, and an identifier group (`backend/schemas/nport/eis_NPORT_Filer.xsd:1808-1823`).
- False negative: `NP-NAV-001` skips drift calculation entirely when any holding has missing computed USD value (`northport/backend/validate/tier2_rules/numeric.py:23-38`).

## The "Everything Passes" Concern

The validator produces meaningful failures because the rule predicates are live and data-dependent:

| Rule | 2025Q4 local run violations | Main observed driver |
| --- | ---: | --- |
| `NP-REF-001` | 8,963 | 5,431 missing computed USD values; 3,532 missing currency-code errors. |
| `NP-REF-002` | 2,481 | Missing fair-value level. |
| `NP-DER-001` | 2,311 | 870 derivative categories with plain long/short payoff profile; 744 `SWO`; 697 `WAR`. The `SWO`/`WAR` flags are likely bad rule design, not necessarily bad filings. |
| `NP-ID-002` | 1,772 | 1,723 CUSIP check failures, 47 ISIN failures, 2 LEI failures. |
| `NP-NAV-001` | 1,079 | Filing-level warnings for missing value reconciliation or percent drift. |
| `NP-ID-001` | 27 | Non-cash/currency holdings with no recognized identifier. |

Total: 16,633 violations, including 15,554 errors and 1,079 warnings. Filings passed: 3,238. Filings failed: 786. These counts come from running `iter_dta_filings()` and `validate_filing()` over `/Users/karanpatel/Downloads/gcap_slice/2025q4.dta` with `pyreadstat` installed in `/private/tmp`; the DTA itself is outside the repo, so treat the counts as reproducible local execution evidence rather than static repo content.

No live rule was completely dead in this run: every live rule fired at least 27 times. However:

- `NP-LIQ-001` is intentionally dead because it is cut and excluded from `LIVE_RULES` (`northport/backend/validate/registry.py:64-73`, `northport/backend/validate/registry.py:95`).
- The `NP-DER-001` branch `profile_indicates_derivative and not derivative_category` is operationally dead for the 2025Q4 GCAP slice because the observed payoff profiles did not contain the marker words from `DERIVATIVE_PROFILE_MARKERS` (`northport/backend/validate/tier2_rules/cross_field.py:8-23`). The mutation test can force it to fire (`northport/backend/tests/test_rules.py:78-80`), but that is not natural-data evidence.
- The real-fixture mutation test asserts each live rule can pass on a base filing and fire after mutation if the local GCAP file exists (`northport/backend/tests/test_rules.py:38-60`). That is useful unit coverage, not proof of regulatory correctness.

## Bottom Line

Tier-1 is defensible as schema conformance when configured against `eis_NPORT_Filer.xsd`. It is not a full SEC acceptance simulator, and in this checkout it fails closed by default because the default `sec_nport.xsd` path is absent.

Tier-2 is useful as a set of internal data-quality checks, but several rules should not be represented as regulatory mandates. The most urgent corrections are `NP-DER-001` category handling and `NP-REF-002` treatment of `N/A`. The known liquidity gap is real: NorthPort currently has no Tier-2 liquidity-classification validation because the required GCAP source field is absent.
