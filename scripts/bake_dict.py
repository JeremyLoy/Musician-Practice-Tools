#!/usr/bin/env python3
"""
bake_dict.py — Pre-compute normTerm and normDef fields in docs/dictionary.js.

Reads each { term, lang, def } entry and adds normTerm / normDef as static
string literals (NFD-normalized, diacritic-stripped, lowercased). The output
is written back to docs/dictionary.js in-place.

Run once after adding or editing dictionary entries:
    python scripts/bake_dict.py
"""

import re
import unicodedata
from pathlib import Path

DICT_PATH = Path(__file__).parent.parent / "docs" / "dictionary.js"


def norm(s: str) -> str:
    """Strip diacritics and lowercase."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    ).lower()


def process(source: str) -> str:
    """
    Find each JS object entry and inject normTerm / normDef.

    Matches lines of the form:
        { term: "...", lang: "...", def: "..." },
    and replaces with:
        { term: "...", lang: "...", normTerm: "...", def: "...", normDef: "..." },

    Existing normTerm/normDef fields are stripped first so the script is
    idempotent.
    """
    # Remove any existing normTerm / normDef fields so re-running is safe
    source = re.sub(r',\s*normTerm:\s*"[^"]*"', "", source)
    source = re.sub(r',\s*normDef:\s*"[^"]*"', "", source)

    def replace_entry(m: re.Match) -> str:
        indent = m.group("indent")
        term_val = m.group("term")
        lang_val = m.group("lang")
        def_val = m.group("def")
        trailing = m.group("trailing")

        nt = norm(term_val)
        nd = norm(def_val)

        return (
            f'{indent}{{ term: "{term_val}", lang: "{lang_val}", '
            f'normTerm: "{nt}", '
            f'def: "{def_val}", normDef: "{nd}" }}{trailing}'
        )

    pattern = re.compile(
        r'(?P<indent>[ \t]*)'
        r'\{ term: "(?P<term>[^"]*)",\s+lang: "(?P<lang>[^"]*)",\s+'
        r'def: "(?P<def>[^"]*)" \}'
        r'(?P<trailing>[^\n]*)',
    )

    return pattern.sub(replace_entry, source)


def main() -> None:
    source = DICT_PATH.read_text(encoding="utf-8")
    result = process(source)
    DICT_PATH.write_text(result, encoding="utf-8")

    # Count entries processed
    count = len(re.findall(r'normTerm:', result))
    print(f"Baked {count} entries in {DICT_PATH}")


if __name__ == "__main__":
    main()
