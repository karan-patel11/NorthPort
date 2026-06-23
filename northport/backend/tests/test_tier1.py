import pytest

from northport.backend.validate.tier1_xsd import (
    SCHEMA_DIR_ENV,
    SCHEMA_ENTRYPOINT_ENV,
    SCHEMA_PATH_ENV,
    SchemaUnavailableError,
    SchemaValidationError,
    assert_schema_ready,
    resolve_schema_path,
    validate_xml,
)


def test_tier1_fails_closed_when_schema_missing(tmp_path):
    with pytest.raises(SchemaUnavailableError):
        validate_xml(b"<root/>", xsd_path=tmp_path / "missing.xsd")


def test_tier1_default_schema_path_loads_checked_in_entrypoint(monkeypatch):
    for env_var in (SCHEMA_PATH_ENV, SCHEMA_DIR_ENV, SCHEMA_ENTRYPOINT_ENV):
        monkeypatch.delenv(env_var, raising=False)

    schema_path = resolve_schema_path()

    assert schema_path.name == "eis_NPORT_Filer.xsd"
    assert schema_path.parts[-4:] == ("backend", "schemas", "nport", "eis_NPORT_Filer.xsd")
    assert_schema_ready()


def test_tier1_fails_closed_when_schema_malformed(tmp_path):
    schema = tmp_path / "malformed.xsd"
    schema.write_text("<xs:schema", encoding="utf-8")

    with pytest.raises(SchemaUnavailableError, match="malformed"):
        validate_xml(b"<root/>", xsd_path=schema)


def test_tier1_compiles_xsd_include_tree_and_rejects_missing_required_element(tmp_path):
    included = tmp_path / "types.xsd"
    included.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="rootType">
    <xs:sequence>
      <xs:element name="required" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>
""",
        encoding="utf-8",
    )
    main = tmp_path / "sec_nport.xsd"
    main.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:include schemaLocation="types.xsd"/>
  <xs:element name="root" type="rootType"/>
</xs:schema>
""",
        encoding="utf-8",
    )

    assert_schema_ready(main)
    validate_xml(b"<root><required>ok</required></root>", xsd_path=main)

    with pytest.raises(SchemaValidationError):
        validate_xml(b"<root/>", xsd_path=main)
