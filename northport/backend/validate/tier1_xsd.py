from __future__ import annotations

from functools import lru_cache
import os
from pathlib import Path

DEFAULT_SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schemas" / "sec_nport.xsd"
DEFAULT_SCHEMA_DIR = DEFAULT_SCHEMA_PATH.parent
SCHEMA_PATH_ENV = "NORTHPORT_XSD_PATH"
SCHEMA_DIR_ENV = "NORTHPORT_XSD_DIR"
SCHEMA_ENTRYPOINT_ENV = "NORTHPORT_XSD_ENTRYPOINT"


class SchemaUnavailableError(RuntimeError):
    """Raised when lxml or the pinned SEC schema is unavailable."""


class SchemaValidationError(ValueError):
    """Raised when XML does not validate against the configured XSD."""


def resolve_schema_path(xsd_path: str | Path | None = None) -> Path:
    """Resolve the configured XSD bundle entrypoint.

    The SEC schema is a bundle. Callers can pass a file path directly, set
    NORTHPORT_XSD_PATH, or set NORTHPORT_XSD_DIR plus an optional
    NORTHPORT_XSD_ENTRYPOINT relative to that directory.
    """
    if xsd_path is not None:
        path = Path(xsd_path)
    elif os.environ.get(SCHEMA_PATH_ENV):
        path = Path(os.environ[SCHEMA_PATH_ENV])
    elif os.environ.get(SCHEMA_DIR_ENV):
        path = _schema_entrypoint_from_dir(
            Path(os.environ[SCHEMA_DIR_ENV]),
            os.environ.get(SCHEMA_ENTRYPOINT_ENV),
        )
    else:
        path = DEFAULT_SCHEMA_PATH

    if path.is_dir():
        path = _schema_entrypoint_from_dir(path, os.environ.get(SCHEMA_ENTRYPOINT_ENV))
    return path.expanduser().resolve()


def compile_schema(xsd_path: str | Path | None = None):
    """Load and compile the pinned SEC N-PORT XSD bundle, failing closed on any problem."""
    schema_path = resolve_schema_path(xsd_path)
    return _compile_schema_at(str(schema_path))


@lru_cache(maxsize=8)
def _compile_schema_at(schema_path_text: str):
    try:
        from lxml import etree
    except ImportError as exc:
        raise SchemaUnavailableError("lxml is required for Tier-1 XSD validation") from exc

    schema_path = Path(schema_path_text)
    if not schema_path.exists():
        raise SchemaUnavailableError(
            f"SEC N-PORT XSD entrypoint is not available at {schema_path}; set "
            f"{SCHEMA_DIR_ENV} or {SCHEMA_PATH_ENV} and see backend/schemas/SCHEMA_SOURCE.md"
        )
    if not schema_path.is_file():
        raise SchemaUnavailableError(f"SEC N-PORT XSD entrypoint must be a file, got {schema_path}")

    try:
        parser = etree.XMLParser(no_network=True, resolve_entities=False)
        schema_doc = etree.parse(str(schema_path), parser)
        return etree.XMLSchema(schema_doc)
    except (OSError, etree.XMLSyntaxError, etree.XMLSchemaParseError) as exc:
        raise SchemaUnavailableError(
            f"SEC N-PORT XSD bundle rooted at {schema_path} did not compile: {exc}"
        ) from exc


def assert_schema_ready(xsd_path: str | Path | None = None) -> None:
    compile_schema(xsd_path)


def validate_xml(xml: bytes | str, *, xsd_path: str | Path | None = None) -> None:
    try:
        from lxml import etree
    except ImportError as exc:
        raise SchemaUnavailableError("lxml is required for Tier-1 XSD validation") from exc

    schema = compile_schema(xsd_path)
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    document = etree.fromstring(xml if isinstance(xml, bytes) else xml.encode("utf-8"), parser=parser)
    if not schema.validate(document):
        errors = "; ".join(error.message for error in schema.error_log)
        raise SchemaValidationError(errors)


def _schema_entrypoint_from_dir(schema_dir: Path, entrypoint: str | None) -> Path:
    directory = schema_dir.expanduser().resolve()
    if not directory.exists():
        raise SchemaUnavailableError(f"SEC N-PORT XSD directory does not exist: {directory}")
    if not directory.is_dir():
        raise SchemaUnavailableError(f"SEC N-PORT XSD directory is not a directory: {directory}")

    if entrypoint:
        candidate = Path(entrypoint)
        if not candidate.is_absolute():
            candidate = directory / candidate
        if not candidate.exists():
            raise SchemaUnavailableError(
                f"{SCHEMA_ENTRYPOINT_ENV}={entrypoint!r} does not exist under {directory}"
            )
        return candidate

    xsd_files = sorted(path for path in directory.glob("*.xsd") if path.is_file())
    if not xsd_files:
        raise SchemaUnavailableError(f"SEC N-PORT XSD directory contains no .xsd files: {directory}")

    exact_names = {"sec_nport.xsd", "nport.xsd", "n-port.xsd"}
    exact_matches = [path for path in xsd_files if path.name.lower() in exact_names]
    if len(exact_matches) == 1:
        return exact_matches[0]

    nport_matches = [
        path
        for path in xsd_files
        if "nport" in path.name.lower().replace("-", "").replace("_", "")
    ]
    if len(nport_matches) == 1:
        return nport_matches[0]

    if len(xsd_files) == 1:
        return xsd_files[0]

    names = ", ".join(path.name for path in xsd_files[:10])
    raise SchemaUnavailableError(
        f"multiple XSD files found in {directory}; set {SCHEMA_ENTRYPOINT_ENV}. "
        f"Candidates: {names}"
    )
