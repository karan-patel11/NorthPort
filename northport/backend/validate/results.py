from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel

from northport.backend.models import Provenance


class Severity(StrEnum):
    ERROR = "error"
    WARNING = "warning"


class Violation(BaseModel):
    rule_id: str
    severity: Severity
    message: str
    provenance: Provenance | None = None
    holding_id: str | None = None

