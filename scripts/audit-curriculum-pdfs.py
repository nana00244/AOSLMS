"""Extract candidate indicator references, not lessons, from locally downloaded NaCCA PDFs.

Usage: python scripts/audit-curriculum-pdfs.py manifest.json output.json
Manifest: [{"file": "path.pdf", "url": "https://...", "phase": "primary"}].
Page references require editorial verification: preambles can contain example codes.
Requires pypdf. No copyrighted instructional prose is emitted.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
from pypdf import PdfReader

pattern = re.compile(r"(?<![A-Za-z0-9])B\s*([1-9])\s*\.\s*(\d+)\s*\.\s*(\d+)\s*\.\s*(\d+)\s*\.\s*(\d+)(?!\d)")
manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
documents = []
for source in manifest:
    path = Path(source["file"])
    reader = PdfReader(path)
    references = {}
    for page_number, page in enumerate(reader.pages, 1):
        for match in pattern.finditer(page.extract_text() or ""):
            code = "B" + ".".join(str(int(value)) for value in match.groups())
            references.setdefault(code, set()).add(page_number)
    indicators = [{"code": code, "pages": sorted(pages)} for code, pages in sorted(
        references.items(), key=lambda item: tuple(map(int, item[0][1:].split("."))))]
    documents.append({"file": path.name, "sourceUrl": source["url"],
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "pdfPages": len(reader.pages),
        "status": "candidate references; not verified curriculum coverage or authored lessons",
        "indicators": indicators})
    print(f"{path.name}: {len(indicators)} candidate indicator references", flush=True)
Path(sys.argv[2]).write_text(json.dumps(documents, indent=2) + "\n", encoding="utf-8")
