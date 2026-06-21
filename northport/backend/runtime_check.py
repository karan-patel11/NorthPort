from __future__ import annotations

from northport.backend.validate.tier1_xsd import (
    SchemaUnavailableError,
    assert_schema_ready,
    resolve_schema_path,
)


def main() -> None:
    missing: list[str] = []
    for module in ("lxml", "pandas", "pyreadstat"):
        try:
            __import__(module)
        except ImportError:
            missing.append(module)

    if missing:
        raise SystemExit(f"Missing runtime dependencies: {', '.join(missing)}")

    try:
        schema_path = resolve_schema_path()
        assert_schema_ready()
    except SchemaUnavailableError as exc:
        raise SystemExit(str(exc)) from exc

    print(
        "NorthPort runtime check passed: dependencies import and SEC N-PORT XSD "
        f"bundle compiles at {schema_path}."
    )


if __name__ == "__main__":
    main()
