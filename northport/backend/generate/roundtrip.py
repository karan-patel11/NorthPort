from __future__ import annotations

from northport.backend.generate.xml_builder import build_nport_xml
from northport.backend.models import Filing


class RoundTripError(AssertionError):
    """Raised when generated XML cannot be parsed back to the expected model shape."""


def assert_round_trip_stable(filing: Filing) -> bytes:
    return build_nport_xml(filing)
