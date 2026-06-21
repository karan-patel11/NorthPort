from __future__ import annotations

from pathlib import Path
from typing import Iterator


def iter_holding_elements(path: str | Path) -> Iterator[dict[str, str]]:
    try:
        from lxml import etree
    except ImportError as exc:
        raise RuntimeError("lxml is required for streaming XML ingestion") from exc

    for _, elem in etree.iterparse(str(path), events=("end",), tag="{*}holding"):
        payload = {"holding_id": elem.get("id", "")}
        for child in elem:
            payload[etree.QName(child).localname] = child.text or ""
        yield payload
        elem.clear()
        while elem.getprevious() is not None:
            del elem.getparent()[0]

