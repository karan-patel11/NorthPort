from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Provenance(BaseModel):
    source: str
    row_number: int | None = None
    line_number: int | None = None
    field_path: str | None = None


class IdentifierSet(BaseModel):
    lei: str | None = None
    cusip: str | None = None
    isin: str | None = None
    ticker: str | None = None
    other: str | None = None

    @field_validator("lei", "cusip", "isin", "ticker", "other", mode="before")
    @classmethod
    def blank_to_none(cls, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @model_validator(mode="after")
    def normalize_codes(self) -> "IdentifierSet":
        if self.lei:
            self.lei = self.lei.upper()
        if self.cusip:
            self.cusip = self.cusip.upper()
        if self.isin:
            self.isin = self.isin.upper()
        if self.ticker:
            self.ticker = self.ticker.upper()
        return self


class FilingHeader(BaseModel):
    registrant_cik: str
    registrant_name: str | None = None
    series_name: str | None = None
    series_id: str | None = None
    series_lei: str | None = None
    class_ids: list[str] = Field(default_factory=list)
    report_period_end: date
    total_assets: Decimal
    total_liabilities: Decimal
    net_assets: Decimal

    @field_validator("registrant_cik", mode="before")
    @classmethod
    def required_text(cls, value: Any) -> str:
        text = str(value).strip() if value is not None else ""
        if not text:
            raise ValueError("field is required")
        return text

    @field_validator("class_ids", mode="before")
    @classmethod
    def parse_class_ids(cls, value: Any) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return [item.strip() for item in str(value).split(";") if item.strip()]


class DerivativeDetail(BaseModel):
    derivative_type: str
    notional_usd: Decimal | None = None
    counterparty: str | None = None


class Holding(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    holding_id: str
    issuer_name: str
    identifiers: IdentifierSet = Field(default_factory=IdentifierSet)
    security_type: str
    security_category: str
    balance: Decimal
    units: str
    other_unit_desc: str | None = None
    currency: str | None = None
    value_usd: Decimal | None = None
    percent_of_net_assets: Decimal
    payoff_profile: str | None = None
    asset_category: str
    other_asset: str | None = None
    issuer_category: str
    other_issuer: str | None = None
    investment_country: str | None = None
    is_restricted_security: str | None = None
    fair_value_level: str | None = None
    liquidity_classification: str | None = None
    derivative_category: str | None = None
    other_identifier_desc: str | None = None
    derivative_detail: DerivativeDetail | None = None
    provenance: Provenance
    field_provenance: dict[str, Provenance] = Field(default_factory=dict)

    @field_validator(
        "holding_id",
        "issuer_name",
        "security_type",
        "security_category",
        "units",
        "asset_category",
        "issuer_category",
        mode="before",
    )
    @classmethod
    def strip_required_text(cls, value: Any) -> str:
        text = str(value).strip() if value is not None else ""
        if not text:
            raise ValueError("field is required")
        return text

    @field_validator("currency", mode="after")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        return value.upper() if value else None

    @field_validator(
        "other_unit_desc",
        "other_asset",
        "other_issuer",
        "investment_country",
        "is_restricted_security",
        "liquidity_classification",
        "derivative_category",
        "other_identifier_desc",
        "fair_value_level",
        mode="before",
    )
    @classmethod
    def optional_text(cls, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None


class Filing(BaseModel):
    header: FilingHeader
    holdings: list[Holding]
    monthly_returns: list[Decimal] = Field(default_factory=list)
    source: str | None = None

    @model_validator(mode="after")
    def require_holdings(self) -> "Filing":
        if not self.holdings:
            raise ValueError("filing must contain at least one holding")
        return self

    def key_fields(self) -> dict[str, Any]:
        return {
            "header": self.header.model_dump(mode="json"),
            "holdings": [
                {
                    "holding_id": item.holding_id,
                    "issuer_name": item.issuer_name,
                    "currency": item.currency,
                    "value_usd": str(item.value_usd) if item.value_usd is not None else None,
                    "percent_of_net_assets": str(item.percent_of_net_assets),
                }
                for item in self.holdings
            ],
        }
