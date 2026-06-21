from __future__ import annotations

from northport.backend.models import Filing


class SecXmlGenerationUnavailable(RuntimeError):
    """Raised when code tries to emit SEC XML without a schema-backed mapping."""


def build_nport_xml(filing: Filing) -> bytes:
    del filing
    raise SecXmlGenerationUnavailable(
        "SEC N-PORT XML generation is disabled until the pinned XSD-backed element mapping is implemented"
    )
