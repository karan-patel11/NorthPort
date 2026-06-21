# Field Mapping

NorthPort maps the GCAP Stata slice to the internal Pydantic model using only
the verified 41 columns below. The adapter rejects a `.dta` file with missing or
unexpected columns; it does not fall back to synthetic, draft, or placeholder
field names.

Verified GCAP columns:

```text
accession_number, holding_id, currency_value, quarter_report, issuer_name,
issuer_lei, issuer_title, issuer_cusip, balance, unit, other_unit_desc,
currency_code, exchange_rate, percentage, payoff_profile, asset_cat,
other_asset, issuer_type, other_issuer, investment_country,
is_restricted_security, fair_value_level, derivative_cat, filing_date,
report_ending_period, report_date, identifier_isin, identifier_ticker,
other_identifier, other_identifier_desc, series_name, series_id, series_lei,
total_assets, net_assets, cik, registrant_name, file_num, lei, fund_key,
quarter_reference
```

## Mapping Table

| Internal field | GCAP source / transform | N-PORT XSD element cited | Confidence |
| --- | --- | --- | --- |
| `Filing.source` | `.dta` path plus `accession_number` | EDGAR accession context | High |
| `FilingHeader.registrant_cik` | `cik` | `cik` | High |
| `FilingHeader.registrant_name` | `registrant_name` | registrant name element | High |
| `FilingHeader.series_name` | `series_name` | series name element | High |
| `FilingHeader.series_id` | `series_id`; blank remains no-data | `seriesId` | High |
| `FilingHeader.series_lei` | `series_lei` | `seriesLei` | High |
| `FilingHeader.class_ids` | no verified GCAP column; empty list | class identifier elements | Low |
| `FilingHeader.report_period_end` | `report_date` | report period/date element | Medium |
| `FilingHeader.total_assets` | `total_assets` | `totalAssets` | High |
| `FilingHeader.total_liabilities` | `total_assets - net_assets` | liabilities element, if present in target schema branch | Medium |
| `FilingHeader.net_assets` | `net_assets` | `netAssets` | High |
| `Holding.holding_id` | `holding_id` | holding identifier context | High |
| `Holding.issuer_name` | `issuer_name`; fallback `issuer_title` only when name is blank | `issuerName` | High |
| `Holding.identifiers.lei` | `issuer_lei` | issuer-level `issuerLei` | High |
| `Holding.identifiers.cusip` | `issuer_cusip` | issuer-level `issuerCusip` | High |
| `Holding.identifiers.isin` | `identifier_isin` | `identifierIsin` | High |
| `Holding.identifiers.ticker` | `identifier_ticker` | `identifierTicker` | High |
| `Holding.identifiers.other` | `other_identifier` | `otherIdentifier` | High |
| `Holding.other_identifier_desc` | `other_identifier_desc` | `otherIdentifierDesc` | High |
| `Holding.security_type` | `issuer_title`; fallback `asset_cat` | legacy internal field, closest N-PORT title/category element | Medium |
| `Holding.security_category` | `asset_cat` | `assetCat` | High |
| `Holding.balance` | `balance` | `balance` | High |
| `Holding.units` | `unit` | `unit` | High |
| `Holding.other_unit_desc` | `other_unit_desc` | `otherUnitDesc` | High |
| `Holding.currency` | `currency_code`; blank remains no-data | `currencyCode` | High |
| `Holding.value_usd` | `currency_value` for USD; `currency_value / exchange_rate` for non-USD; missing non-USD rate remains no-data | `currencyValue`, `exchangeRate`, `valUSD` | High |
| `Holding.percent_of_net_assets` | `percentage` exactly; no derived fallback | `pctVal` | High |
| `Holding.payoff_profile` | `payoff_profile`; blank remains no-data | `payoffProfile` | High |
| `Holding.asset_category` | `asset_cat` | `assetCat` | High |
| `Holding.other_asset` | `other_asset` | `otherAsset` | High |
| `Holding.issuer_category` | `issuer_type` | `issuerCat` / issuer type element | Medium |
| `Holding.other_issuer` | `other_issuer` | `otherIssuer` | High |
| `Holding.investment_country` | `investment_country` | investment country element | High |
| `Holding.is_restricted_security` | `is_restricted_security` | restricted security indicator | High |
| `Holding.fair_value_level` | `fair_value_level`; blank remains no-data | `fairValueLevel` | High |
| `Holding.derivative_category` | `derivative_cat` | `derivativeCategory` | High |
| `Provenance.row_number` | streamed Stata data row number | source row context | High |
| `Provenance.field_path` | selected GCAP column or `derived:*` transform | source field context | High |

## Currency And USD

There is no GCAP USD-value column. `currency_value` is treated as denominated in
`currency_code`, paired with `exchange_rate`.

The real GCAP slice confirms `exchange_rate` is quoted as local-currency units
per USD, so non-USD values are converted by division:

```text
value_usd = currency_value / exchange_rate
```

Evidence from `/Users/karanpatel/Downloads/gcap_slice/2025q4.dta`:

- USD rows have blank `exchange_rate`; this is expected identity encoding, not
  no-data. `value_usd = currency_value` for USD.
- JPY example: `300,129,516.82 / 154.11 = 1,947,501.89`; multiplication would
  produce `46,252,959,837.13`.
- EUR example: `317,765,637.77 / 0.86756604 = 366,272,563.84`; multiplication
  would produce `275,682,676.01`.
- GBP example: `337,920,842.74 / 0.7612088 = 443,926,610.86`; multiplication
  would produce `257,228,319.20`.

For non-USD rows with a blank or zero rate, NorthPort sets computed `value_usd`
to no-data and lets `NP-REF-001`/`NP-NAV-001` flag the missing input.

`percentage` maps directly to `Holding.percent_of_net_assets`. NorthPort does
not derive percentage from `currency_value / net_assets * 100`.

## Tier-2 Rule Traceability

| Rule | Status | GCAP fields | N-PORT elements checked | Notes |
| --- | --- | --- | --- | --- |
| `NP-ID-001` | live | `issuer_lei`, `issuer_cusip`, `identifier_isin`, `identifier_ticker`, `other_identifier`, `asset_cat` | `issuerLei`, `issuerCusip`, `identifierIsin`, `identifierTicker`, `otherIdentifier`, `assetCat` | LEI and CUSIP are issuer-level in GCAP and are mapped to issuer-level XSD elements. |
| `NP-ID-002` | live | `issuer_lei`, `issuer_cusip`, `identifier_isin` | `issuerLei`, `issuerCusip`, `identifierIsin` | LEI uses ISO 17442 / ISO 7064 check digits. |
| `NP-REF-001` | live | `currency_code`, `currency_value`, `exchange_rate` | `currencyCode`, `currencyValue`, `exchangeRate`, `valUSD` | Validates ISO currency and finite computed USD value. Negative derivative values are allowed. |
| `NP-REF-002` | live | `fair_value_level` | `fairValueLevel` | Accepts levels `1`, `2`, `3` and normalized `LEVEL_*` spellings. |
| `NP-LIQ-001` | cut | no verified liquidity column | `liquidityClassification` | The `.dta` has no `liquidity_classification` or `liquidity_cat`. `is_restricted_security` is not liquidity and is not substituted. |
| `NP-DER-001` | live | `payoff_profile`, `derivative_cat` | `payoffProfile`, `derivativeCategory` | Rewritten to use only verified derivative inputs; no derivative type, notional, or counterparty is fabricated. |
| `NP-NAV-001` | live | `currency_value`, `exchange_rate`, `percentage`, `net_assets` | `valUSD`, `pctVal`, `netAssets` | Reconciles computed USD value to reported GCAP percentage within tolerance. |

## Explicitly Absent Columns

The verified `.dta` does not contain these earlier placeholder fields:

```text
valUSD, pct_val, pctval, percent_of_net_assets, units,
liquidity_classification, liquidity_cat, derivative_type, notional_usd,
notional_amount, counterparty, issuer_cat, issuer_category, fair_val_level
```

Rules or metrics requiring absent fields must report cut/no-data rather than
fabricating source input.
