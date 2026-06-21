# SEC N-PORT Schema Pinning

Tier-1 validation is intentionally hard-gated on the official SEC Form N-PORT XSD
bundle, including local includes/imports. Place the pinned schema bundle on disk
and configure either:

```text
NORTHPORT_XSD_DIR=/path/to/sec/xsd/bundle
NORTHPORT_XSD_ENTRYPOINT=sec_nport.xsd
```

or:

```text
NORTHPORT_XSD_PATH=/path/to/sec/xsd/bundle/sec_nport.xsd
```

If no environment variable is set, the local default entrypoint remains:

```text
northport/backend/schemas/sec_nport.xsd
```

The validator in `northport.backend.validate.tier1_xsd` uses
`lxml.etree.XMLSchema` with network access disabled. If the bundle entrypoint is
absent, an include/import cannot be resolved from disk, or the bundle does not
compile, Tier-1 raises `SchemaUnavailableError` instead of falling back to a
permissive local schema.

Source-of-truth references to collect and pin during Milestone 1:

- SEC Form N-PORT XML technical specification
- SEC EDGAR schema bundle containing the current N-PORT XSD
- GCAP "Public Security-Level Data on U.S. Fund Holdings" ReadMe for field mapping

Record the SEC URL, retrieval date, checksum, and any included/imported schema files
in this folder when the production XSD is added.
